import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { brandProgress } from "../../../db/schema";
import { apiError, ApiError, boundedText, readJson, requireApiUser } from "../_shared";

const phases = ["品牌定位", "产品研发", "视觉建立", "上市准备", "品牌推广", "渠道增长", "品牌扩张"] as const;
type Phase = typeof phases[number];

function publicProgress(row?: typeof brandProgress.$inferSelect) {
  const legacy: Record<string, Phase> = { "定位": "品牌定位", "视觉": "视觉建立", "产品": "产品研发", "内容": "品牌推广", "渠道": "渠道增长", "发布": "上市准备", "增长": "品牌扩张" };
  return row ? {
    currentPhase: legacy[row.currentPhase] ?? row.currentPhase,
    annualDirection: row.annualDirection,
    monthlyFocus: row.monthlyFocus,
    blocker: row.blocker,
    nextAction: row.nextAction,
    updatedAt: row.updatedAt,
  } : { currentPhase: "品牌定位" as Phase, annualDirection: "", monthlyFocus: "", blocker: "", nextAction: "", updatedAt: null };
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const [row] = await getDb().select().from(brandProgress).where(eq(brandProgress.ownerId, user.id)).limit(1);
    return Response.json({ progress: publicProgress(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ currentPhase?: unknown; annualDirection?: unknown; monthlyFocus?: unknown; blocker?: unknown; nextAction?: unknown }>(request);
    if (typeof payload.currentPhase !== "string" || !phases.includes(payload.currentPhase as Phase)) throw new ApiError(400, "品牌阶段不正确");
    const values = {
      ownerId: user.id,
      currentPhase: payload.currentPhase as Phase,
      annualDirection: boundedText(payload.annualDirection, "年度方向", 500),
      monthlyFocus: boundedText(payload.monthlyFocus, "本月重点", 300),
      blocker: boundedText(payload.blocker, "当前阻碍", 300),
      nextAction: boundedText(payload.nextAction, "下一步行动", 300),
      updatedAt: new Date(),
    };
    const [row] = await getDb().insert(brandProgress).values(values).onConflictDoUpdate({ target: brandProgress.ownerId, set: values }).returning();
    return Response.json({ progress: publicProgress(row) });
  } catch (error) { return apiError(error); }
}
