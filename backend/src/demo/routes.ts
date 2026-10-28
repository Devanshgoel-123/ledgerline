import { Router } from "express";
import { loadDemoDataController, removeDemoDataController } from "./controller.js";

export const demoRouter = Router();


demoRouter.post("/load", loadDemoDataController);
demoRouter.delete("/", removeDemoDataController);
