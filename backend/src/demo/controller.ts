import type { RequestHandler } from "express";
import { loadDemoData, removeDemoData } from "./service.js";

export const loadDemoDataController: RequestHandler = async (req, res) => {
  res.json(await loadDemoData(req.user!.id));
};

export const removeDemoDataController: RequestHandler = async (req, res) => {
  res.json(await removeDemoData(req.user!.id));
};
