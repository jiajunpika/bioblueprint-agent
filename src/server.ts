import "dotenv/config";
import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { preprocessImages } from "./utils/preprocess";
import { analyzeWithAllPhases } from "./pipeline";
import { createTask, getTask, updateTask } from "./taskStore";

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Create unique directory for each upload batch
    const uploadId = randomUUID();
    const uploadDir = path.join("uploads", uploadId);
    await fs.mkdir(uploadDir, { recursive: true });
    (req as any).uploadDir = uploadDir; // Store for later cleanup
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50, // Max 50 images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/heic"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and HEIC images are allowed"));
    }
  },
});

// Middleware
app.use(express.json());

// Serve static files (frontend)
app.use(express.static("public"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// POST /api/analyze - Upload images and start analysis
app.post("/api/analyze", upload.array("images"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    // Create task
    const taskId = randomUUID();
    const task = createTask(taskId);

    // Get upload directory
    const uploadDir = (req as any).uploadDir as string;

    // Return task ID immediately
    res.json({ taskId });

    // Process images asynchronously
    processImagesAsync(taskId, uploadDir).catch((error) => {
      console.error(`Task ${taskId} failed:`, error);
      updateTask(taskId, {
        status: "failed",
        error: error.message,
      });
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/task/:id - Check task status
app.get("/api/task/:id", (req, res) => {
  const task = getTask(req.params.id);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  // Return task status (omit internal fields)
  const response: any = {
    id: task.id,
    status: task.status,
    createdAt: task.createdAt,
  };

  if (task.status === "completed" && task.result) {
    response.result = task.result;
  }

  if (task.status === "failed" && task.error) {
    response.error = task.error;
  }

  res.json(response);
});

// GET /api/datasets - List available test datasets
app.get("/api/datasets", async (req, res) => {
  try {
    const datasetsDir = path.join(__dirname, "../datasets");
    const dirs = await fs.readdir(datasetsDir);

    const datasets = await Promise.all(
      dirs.map(async (dir) => {
        const dirPath = path.join(datasetsDir, dir);
        const stat = await fs.stat(dirPath);

        if (!stat.isDirectory()) return null;

        // Count images in directory
        const files = await fs.readdir(dirPath);
        const imageFiles = files.filter((f) =>
          /\.(jpg|jpeg|png|heic)$/i.test(f)
        );

        return {
          name: dir,
          imageCount: imageFiles.length,
        };
      })
    );

    res.json(datasets.filter((d) => d !== null));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/analyze-dataset - Analyze using a test dataset
app.post("/api/analyze-dataset", async (req, res) => {
  try {
    const { dataset } = req.body;

    if (!dataset) {
      return res.status(400).json({ error: "Dataset name required" });
    }

    const datasetPath = path.join(__dirname, "../datasets", dataset);

    // Check if dataset exists
    try {
      await fs.access(datasetPath);
    } catch {
      return res.status(404).json({ error: "Dataset not found" });
    }

    // Create task
    const taskId = randomUUID();
    const task = createTask(taskId);

    // Return task ID immediately
    res.json({ taskId });

    // Process dataset asynchronously
    processImagesAsync(taskId, datasetPath).catch((error) => {
      console.error(`Task ${taskId} failed:`, error);
      updateTask(taskId, {
        status: "failed",
        error: error.message,
      });
    });
  } catch (error: any) {
    console.error("Dataset analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Async image processing function
async function processImagesAsync(taskId: string, uploadDir: string) {
  try {
    updateTask(taskId, { status: "processing" });

    // Step 1: Preprocess images
    console.log(`[${taskId}] Preprocessing images from ${uploadDir}...`);
    const processedImages = await preprocessImages(uploadDir);

    // Step 2: Run analysis pipeline
    console.log(`[${taskId}] Running analysis pipeline...`);
    const result = await analyzeWithAllPhases(processedImages);

    // Step 3: Save result
    updateTask(taskId, {
      status: "completed",
      result: result.blueprint,
    });

    console.log(`[${taskId}] Analysis completed`);

    // Cleanup upload directory
    await cleanupDirectory(uploadDir);
  } catch (error: any) {
    console.error(`[${taskId}] Processing error:`, error);
    updateTask(taskId, {
      status: "failed",
      error: error.message,
    });

    // Cleanup upload directory even on error
    await cleanupDirectory(uploadDir);
  }
}

// Cleanup temporary directory
async function cleanupDirectory(dirPath: string) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to delete directory ${dirPath}:`, error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`BioBlueprint API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: POST http://localhost:${PORT}/api/analyze`);
});
