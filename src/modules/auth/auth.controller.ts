import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { AppError } from "../../middlewares/error.middleware";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new AppError("A valid email is required", 400);
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        throw new AppError("Password must be at least 6 characters", 400);
      }

      const result = await this.authService.register(
        email.trim().toLowerCase(),
        password,
      );

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      const result = await this.authService.login(
        email.trim().toLowerCase(),
        password,
      );

      return res.status(200).json({
        success: true,
        message: "Logged in successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
