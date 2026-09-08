import { ApiError, apiError } from "../../_shared";

export async function POST() {
  try {
    throw new ApiError(403, "此网站仅开放一个账户");
  } catch (error) {
    return apiError(error);
  }
}
