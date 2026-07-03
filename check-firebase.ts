import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Try to initialize with application default credentials
try {
  if (!getApps().length) {
    initializeApp({ projectId: "fayapay-ece98" });
  }
  const db = getFirestore();
  console.log("Admin SDK initialized successfully");
  
  // Try to list collections
  db.listCollections().then(collections => {
    console.log("Collections:", collections.map(c => c.id));
  }).catch(err => {
    console.log("List collections error:", err.message);
  });
} catch (e) {
  console.log("Init error:", e instanceof Error ? e.message : String(e));
}
