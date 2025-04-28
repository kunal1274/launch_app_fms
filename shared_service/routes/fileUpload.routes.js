// 7a) Upload endpoint
app.post("/api/files", upload.array("files"), async (req, res) => {
  const docs = await Promise.all(
    req.files.map((f) =>
      FileModel.create({
        filename: f.filename,
        originalName: f.originalname,
        url: `/uploads/${f.filename}`,
      })
    )
  );
  res.json(docs);
});

// 7b) List files
app.get("/api/files", async (req, res) => {
  const all = await FileModel.find().sort("-createdAt");
  res.json(all);
});

// 7c) Delete file
app.delete("/api/files/:id", async (req, res) => {
  try {
    // Find document
    const file = await FileModel.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "Not found" });

    // Delete from DB
    await FileModel.findByIdAndDelete(req.params.id);

    // Delete from disk
    fs.unlinkSync(path.join(process.cwd(), "uploads", file.filename));

    return res.sendStatus(204);
  } catch (err) {
    console.error("❌ Delete error", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});
