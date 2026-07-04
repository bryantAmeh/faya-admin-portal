import { NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, limit, writeBatch } from "firebase/firestore";

/**
 * POST /api/pos-device-request
 *
 * Called by the Faya POS app when a merchant logs in on a NEW device. The POS
 * app reads REAL device capabilities from the phone hardware APIs and submits
 * them here so the admin portal can approve / decline device binding.
 *
 * The POS app authenticates with Firebase Auth (merchant email + password) and
 * sends its Firebase ID token + UID. This route writes a `pos_device_requests`
 * document with the REAL device data (NOT hardcoded) to Firestore.
 *
 * Approval rule (enforced by `canBeApproved`):
 *   canBeApproved = nfcSupported || cardReaderSupported || swipeSupported
 *   If none are supported the request is created with status "auto_declined".
 *
 * Expected body (all deviceInfo fields are read from the phone — NOT hardcoded):
 *   {
 *     "merchantId": string,          // Firebase Auth UID of the logged-in merchant
 *     "merchantName": string,        // tradingName from the merchant profile
 *     "countryCode": string,         // e.g. "NG"
 *     "merchantCode": string,        // optional, e.g. "FAY-NG-M-31946"
 *     "type": "phone_pos" | "physical_terminal",
 *     "idToken": string,             // Firebase ID token (for provenance logging)
 *     "deviceInfo": {
 *       "deviceModel": string,        // Build.MODEL
 *       "osVersion": string,          // Build.VERSION.RELEASE
 *       "appVersion": string,         // Faya POS app version
 *       "nfcSupported": boolean,      // NFC adapter availability
 *       "cardReaderSupported": boolean, // chip/EMV reader
 *       "swipeSupported": boolean,    // magnetic stripe reader
 *       "deviceIntegrityPassed": boolean, // Play Integrity / root detection
 *       "screenLockEnabled": boolean, // KeyguardManager.isDeviceSecure
 *       "batteryLevel": number        // 0–100
 *     }
 *   }
 *
 * DELETE /api/pos-device-request?confirm=clear-all
 *   Wipes ALL pos_device_requests documents (admin use — clears seeded / fake
 *   data so only real device submissions remain).
 * DELETE /api/pos-device-request?merchantId=<uid>
 *   Wipes only the requests belonging to a single merchant.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
};

function getDb() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

export async function POST(request: Request) {
  try {
    const db = getDb();

    /* ---------- 1. Parse + validate the merchant + device payload ---------- */
    const body = (await request.json()) as {
      merchantId?: string;
      merchantName?: string;
      countryCode?: string;
      merchantCode?: string;
      type?: string;
      idToken?: string;
      deviceInfo?: Record<string, unknown>;
    };

    const merchantId = (body.merchantId ?? "").trim();
    const merchantName = (body.merchantName ?? "").trim();
    const countryCode = (body.countryCode ?? "").trim().toUpperCase();
    const merchantCode = (body.merchantCode ?? "").trim();

    if (!merchantId || !merchantName || !countryCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "merchantId, merchantName, and countryCode are required. The POS app must read these from the logged-in merchant's Firebase Auth UID + merchant profile.",
        },
        { status: 400 },
      );
    }

    const type = body.type === "physical_terminal" ? "physical_terminal" : "phone_pos";
    const di = body.deviceInfo ?? {};

    // Coerce + validate every deviceInfo field. These values MUST come from the
    // phone — reject the request if any required field is missing or wrong type.
    const deviceModel = typeof di.deviceModel === "string" ? di.deviceModel.trim() : "";
    const osVersion = typeof di.osVersion === "string" ? di.osVersion.trim() : "";
    const appVersion = typeof di.appVersion === "string" ? di.appVersion.trim() : "";
    const nfcSupported = di.nfcSupported === true;
    const cardReaderSupported = di.cardReaderSupported === true;
    const swipeSupported = di.swipeSupported === true;
    const deviceIntegrityPassed = di.deviceIntegrityPassed === true;
    const screenLockEnabled = di.screenLockEnabled === true;
    const batteryLevelRaw = Number(di.batteryLevel);
    const batteryLevel = Number.isFinite(batteryLevelRaw)
      ? Math.max(0, Math.min(100, Math.round(batteryLevelRaw)))
      : 0;

    if (!deviceModel || !osVersion || !appVersion) {
      return NextResponse.json(
        {
          success: false,
          error:
            "deviceInfo.deviceModel, deviceInfo.osVersion, and deviceInfo.appVersion are required and must be read from the device (Build.MODEL, Build.VERSION.RELEASE, app version). Hardcoded values are not accepted.",
        },
        { status: 400 },
      );
    }
    // Reject if the three capability booleans are not explicitly booleans
    if (
      typeof di.nfcSupported !== "boolean" ||
      typeof di.cardReaderSupported !== "boolean" ||
      typeof di.swipeSupported !== "boolean" ||
      typeof di.deviceIntegrityPassed !== "boolean" ||
      typeof di.screenLockEnabled !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "deviceInfo.nfcSupported, cardReaderSupported, swipeSupported, deviceIntegrityPassed, and screenLockEnabled must be explicit booleans read from the device hardware checks.",
        },
        { status: 400 },
      );
    }

    /* ---------- 2. Compute approval eligibility ---------- */
    const canBeApproved = nfcSupported || cardReaderSupported || swipeSupported;

    /* ---------- 3. Generate a sequential request code ---------- */
    const seqQ = query(
      collection(db, "pos_device_requests"),
      where("countryCode", "==", countryCode),
      orderBy("requestedAt", "desc"),
      limit(1),
    );
    const seqSnap = await getDocs(seqQ).catch(() => ({ empty: true, docs: [] as { data: () => Record<string, unknown> }[] }));
    let seq = 1;
    if (!seqSnap.empty) {
      const lastCode = (seqSnap.docs[0].data().requestCode as string) ?? "";
      const m = lastCode.match(/(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    const requestCode = `POS-REQ-${countryCode}-${String(seq).padStart(5, "0")}`;

    /* ---------- 4. Write the request document ---------- */
    const now = Date.now();
    const autoDeclined = !canBeApproved;
    const requestId = `posreq_${countryCode}_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const docData = {
      id: requestId,
      requestCode,
      merchantId,
      merchantName,
      merchantCode,
      countryCode,
      type,
      requestedAt: now,
      deviceInfo: {
        deviceModel,
        osVersion,
        appVersion,
        nfcSupported,
        cardReaderSupported,
        swipeSupported,
        deviceIntegrityPassed,
        screenLockEnabled,
        batteryLevel,
      },
      canBeApproved,
      status: autoDeclined ? "auto_declined" : "pending",
      reviewedBy: null,
      reviewedAt: autoDeclined ? now : null,
      declineReason: autoDeclined
        ? "Auto-declined: device does not support any payment method (NFC, card reader, or swipe)."
        : null,
      notes: autoDeclined
        ? "Auto-declined on submission — no payment method available on device."
        : "Submitted by Faya POS app on new device login.",
      // Provenance marker so the admin can tell real submissions from seed data
      source: "faya_pos_app",
      submittedByUid: merchantId,
      idTokenProvided: Boolean(body.idToken),
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "pos_device_requests", requestId), docData);

    return NextResponse.json({
      success: true,
      request: docData,
      autoDeclined,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/pos-device-request?confirm=clear-all
 * DELETE /api/pos-device-request?merchantId=<uid>
 *
 * Clears pos_device_requests documents. Intended for admin use to wipe
 * seeded/hardcoded data so only real POS-app submissions remain.
 */
export async function DELETE(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get("confirm");
    const merchantId = searchParams.get("merchantId");

    let q;
    if (merchantId) {
      q = query(collection(db, "pos_device_requests"), where("merchantId", "==", merchantId));
    } else if (confirm === "clear-all") {
      q = collection(db, "pos_device_requests");
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pass ?confirm=clear-all to wipe every request, or ?merchantId=<uid> to wipe one merchant's requests.",
        },
        { status: 400 },
      );
    }

    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({
      success: true,
      deleted: snap.size,
      scope: merchantId ? `merchant=${merchantId}` : "all",
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
