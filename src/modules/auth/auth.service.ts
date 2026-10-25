import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IAuthRepository } from "./auth.repository";
import { ENV } from "../../config/env";
import { AppError } from "../../middlewares/error.middleware";

export class AuthService {
  constructor(private readonly authRepo: IAuthRepository) {}

  async register(email: string, pass: string) {
    const existingUser = await this.authRepo.findByEmail(email);
    if (existingUser) {
      throw new AppError("Email is already registered", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(pass, salt);

    const user = await this.authRepo.create(email, passwordHash, 100);
    const token = this.generateToken(user.id, user.email);

    return {
      userId: user.id,
      email: user.email,
      token,
    };
  }

  async login(email: string, pass: string) {
    const user = await this.authRepo.findByEmail(email);
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = this.generateToken(user.id, user.email);

    return {
      userId: user.id,
      email: user.email,
      token,
    };
  }

  private generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, ENV.JWT_SECRET, { expiresIn: "1d" });
  }
}
