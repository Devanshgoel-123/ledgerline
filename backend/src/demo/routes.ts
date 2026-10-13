import { Router } from "express";
import { requireAuth } from "../auth/service.js";
import { loadDemoDataController, removeDemoDataController } from "./controller.js";

export const demoRouter = Router();

demoRouter.use(requireAuth);

demoRouter.post("/load", loadDemoDataController);
demoRouter.delete("/", removeDemoDataController);
