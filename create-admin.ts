import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

const app = initializeApp({
  apiKey: "AIzaSyAuHmu4z06EPZJ6L4p0a_r-lrbGYo_RyPM",
  authDomain: "fayapay-ece98.firebaseapp.com",
  projectId: "fayapay-ece98",
  appId: "1:401350981808:web:127488fb53c6e534736375",
});
const auth = getAuth(app);

async function main() {
  try {
    const cred = await createUserWithEmailAndPassword(auth, "angerjude8@gmail.com", "admin123");
    console.log(`Created: ${cred.user.uid} (${cred.user.email})`);
  } catch (e: any) {
    if (e.code === "email-already-in-use") {
      console.log("Already exists — verifying login...");
      const cred = await signInWithEmailAndPassword(auth, "angerjude8@gmail.com", "admin123");
      console.log(`Verified: ${cred.user.uid} (${cred.user.email})`);
    } else {
      console.log("Error:", e.code, e.message);
    }
  }
}
main();
