const mongoose = require("mongoose");
const Notification = require("../models/notificationSchema");

describe("Notification schema type validation", () => {
  test("rejects unknown type", async () => {
    const doc = new Notification({
      userId: new mongoose.Types.ObjectId(),
      message: "test",
      type: "unknown_type",
    });
    await expect(doc.validate()).rejects.toThrow();
  });

  test('accepts "reminder" type', async () => {
    const doc = new Notification({
      userId: new mongoose.Types.ObjectId(),
      message: "test",
      type: "reminder",
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test('accepts "substitute" type', async () => {
    const doc = new Notification({
      userId: new mongoose.Types.ObjectId(),
      message: "test",
      type: "substitute",
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});
