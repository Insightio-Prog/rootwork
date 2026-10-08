import { renameSync, existsSync } from "node:fs";
if (existsSync("public/viewer.html")) {
  renameSync("public/viewer.html", "public/viewer.template.html");
  console.log("viewer template ready: public/viewer.template.html");
} else {
  throw new Error("public/viewer.html was not produced");
}
