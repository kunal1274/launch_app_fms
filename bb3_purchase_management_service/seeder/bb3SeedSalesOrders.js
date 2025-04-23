import connectToDb from "../../database/mongoDb.js";

import faker from "@faker-js/faker"; // npm i @faker-js/faker
import { SalesOrderModel } from "../../models/salesorder.model.js";

await connectToDb();
// await SalesOrderModel.deleteMany();

const customers = [...Array(5)].map(() => faker.database.mongodbObjectId());
const items = [...Array(5)].map(() => faker.database.mongodbObjectId());

for (let i = 1; i <= 25; i++) {
  await SalesOrderModel.create({
    orderType: "Sales",
    customer: faker.helpers.arrayElement(customers),
    item: faker.helpers.arrayElement(items),
    quantity: faker.number.float({ min: 1, max: 10, precision: 0.01 }),
    price: faker.number.float({ min: 100, max: 999, precision: 0.01 }),
    status: "Draft",
    createdBy: "Seeder",
  });
}
console.log("🌱 25 sample sales orders inserted");
process.exit(0);
