declare global {
  namespace Express {
    interface Locals {
      admin?: {
        id: string;
        username: string;
        role: string;
      };
      adminSessionToken?: string;
    }
  }
}

export {};
