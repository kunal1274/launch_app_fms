// In-built Node JS Modules Import
import expressAumMrigah from "express";

// 3rd-Party Node JS Modules Import

// Project FMS server related imports

console.log("This index.js file is working as expected");
const AumMrigahApp = expressAumMrigah();

const PORT = 3000;

AumMrigahApp.listen(PORT, () => {
  console.log(`The Node fms-server.1.0.0 is running at port ${PORT}`);
});
