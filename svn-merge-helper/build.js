const packager = require("electron-packager");
const electronInstaller = require("electron-winstaller");
const path = require("path");

async function build() {
  console.log("Packaging app...");
  const appPaths = await packager({
    dir: ".",
    name: "Code7",
    platform: "win32",
    arch: "x64",
    out: "dist",
    overwrite: true,
    asar: true,
    ignore: [/^\/dist$/, /^\/openspec$/, /^\/\.git$/, /^\/\.spectra$/],
  });

  console.log(`App packaged successfully to ${appPaths[0]}`);

  console.log("Creating installer...");
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: appPaths[0],
      outputDirectory: path.join(__dirname, "dist/installer"),
      authors: "Company",
      exe: "Code7.exe",
      setupExe: "Code7-setup-1.1.0.exe",
      noMsi: true,
      description: "Code7",
    });
    console.log("Installer created successfully!");
  } catch (e) {
    console.log(`Error creating installer: ${e.message}`);
  }
}

build();
