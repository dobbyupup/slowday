import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { readingCanvases, readingItems } from "../../../../db/schema";
import { apiError, ApiError, boundedText, readJson, requireApiUser } from "../../_shared";

type CanvasNode = { readingItemId: number; x: number; y: number; width?: number; height?: number; groupId?: string };
type CanvasEdge = { from: number; to: number; fromSide?: "left" | "right"; toSide?: "left" | "right" };
type CanvasNote = { id: string; x: number; y: number; text: string };
type CanvasGroup = { id: string; x: number; y: number; width: number; height: number; title: string };
type CanvasLayout = { nodes: CanvasNode[]; edges: CanvasEdge[]; notes: CanvasNote[]; groups: CanvasGroup[]; excludedItemIds: number[] };
const emptyLayout = (): CanvasLayout => ({ nodes: [], edges: [], notes: [], groups: [], excludedItemIds: [] });

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const params = new URL(request.url).searchParams;
    if (!params.has("tag")) {
      const canvases = await getDb().select({ name: readingCanvases.tag }).from(readingCanvases)
        .where(eq(readingCanvases.ownerId, user.id)).orderBy(desc(readingCanvases.updatedAt));
      return Response.json({ canvases }, { headers: { "Cache-Control": "no-store" } });
    }
    const tag = boundedText(params.get("tag"), "画布名称", 80, true);
    const [row] = await getDb().select({ layout: readingCanvases.layout }).from(readingCanvases)
      .where(and(eq(readingCanvases.ownerId, user.id), eq(readingCanvases.tag, tag))).limit(1);
    return Response.json({ layout: row ? parseStoredLayout(row.layout) : emptyLayout() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ tag?: unknown; nodes?: unknown; edges?: unknown; notes?: unknown; groups?: unknown; excludedItemIds?: unknown }>(request);
    const tag = boundedText(payload.tag, "标签", 80, true);
    const layout = await validateLayout(user.id, payload.nodes, payload.edges, payload.notes, payload.groups, payload.excludedItemIds);
    const now = new Date();
    await getDb().insert(readingCanvases).values({ ownerId: user.id, tag, layout: JSON.stringify(layout), createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [readingCanvases.ownerId, readingCanvases.tag], set: { layout: JSON.stringify(layout), updatedAt: now } });
    return Response.json({ layout });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request, { mutation: true });
    const payload = await readJson<{ name?: unknown }>(request);
    const tag = boundedText(payload.name, "画布名称", 80, true);
    const now = new Date();
    await getDb().insert(readingCanvases).values({ ownerId: user.id, tag, layout: JSON.stringify(emptyLayout()), createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: [readingCanvases.ownerId, readingCanvases.tag] });
    return Response.json({ name: tag }, { status: 201 });
  } catch (error) { return apiError(error); }
}

async function validateLayout(ownerId: string, rawNodes: unknown, rawEdges: unknown, rawNotes: unknown, rawGroups: unknown, rawExcludedItemIds: unknown): Promise<CanvasLayout> {
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges) || !Array.isArray(rawNotes) || !Array.isArray(rawGroups)) throw new ApiError(400, "画布数据格式不正确");
  const rawExcluded = Array.isArray(rawExcludedItemIds) ? rawExcludedItemIds : [];
  if (rawNodes.length > 200 || rawEdges.length > 400 || rawNotes.length > 100 || rawGroups.length > 40) throw new ApiError(400, "画布内容过多");
  const nodes: CanvasNode[] = [];
  const ids = new Set<number>();
  for (const raw of rawNodes) {
    if (!raw || typeof raw !== "object") throw new ApiError(400, "画布卡片格式不正确");
    const value = raw as Record<string, unknown>;
    const readingItemId = Number(value.readingItemId);
    const x = Number(value.x);
    const y = Number(value.y); const width = value.width === undefined ? undefined : Number(value.width); const height = value.height === undefined ? undefined : Number(value.height); const groupId = typeof value.groupId === "string" ? value.groupId.slice(0, 80) : undefined;
    if (!Number.isInteger(readingItemId) || readingItemId <= 0 || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100_000 || Math.abs(y) > 100_000) throw new ApiError(400, "画布卡片位置不正确");
    if ((width !== undefined && (!Number.isFinite(width) || width < 160 || width > 720)) || (height !== undefined && (!Number.isFinite(height) || height < 150 || height > 720))) throw new ApiError(400, "画布卡片尺寸不正确");
    if (ids.has(readingItemId)) continue;
    ids.add(readingItemId);
    nodes.push({ readingItemId, x: Math.round(x), y: Math.round(y), ...(width === undefined ? {} : { width: Math.round(width) }), ...(height === undefined ? {} : { height: Math.round(height) }), ...(groupId ? { groupId } : {}) });
  }
  if (nodes.length) {
    const owned = await getDb().select({ id: readingItems.id }).from(readingItems)
      .where(and(eq(readingItems.ownerId, ownerId), inArray(readingItems.id, [...ids])));
    const validIds = new Set(owned.map(item => item.id));
    if (validIds.size !== ids.size) throw new ApiError(403, "画布中包含无权访问的灵感");
  }
  const edges: CanvasEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const raw of rawEdges) {
    if (!raw || typeof raw !== "object") throw new ApiError(400, "连线格式不正确");
    const value = raw as Record<string, unknown>;
    const first = Number(value.from);
    const second = Number(value.to);
    if (!Number.isInteger(first) || !Number.isInteger(second) || first === second || !ids.has(first) || !ids.has(second)) continue;
    const from = first;
    const to = second;
    const fromSide = value.fromSide === "left" ? "left" : "right"; const toSide = value.toSide === "right" ? "right" : "left";
    const key = `${from}:${fromSide}:${to}:${toSide}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, fromSide, toSide });
  }
  const notes: CanvasNote[] = [];
  const noteIds = new Set<string>();
  for (const raw of rawNotes) {
    if (!raw || typeof raw !== "object") throw new ApiError(400, "文本节点格式不正确");
    const value = raw as Record<string, unknown>;
    const id = boundedText(value.id, "文本节点编号", 80, true);
    const text = boundedText(value.text, "画布文本", 2000);
    const x = Number(value.x); const y = Number(value.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100_000 || Math.abs(y) > 100_000) throw new ApiError(400, "文本节点位置不正确");
    if (noteIds.has(id)) continue;
    noteIds.add(id); notes.push({ id, text, x: Math.round(x), y: Math.round(y) });
  }
  const groups: CanvasGroup[] = [];
  const groupIds = new Set<string>();
  for (const raw of rawGroups) {
    if (!raw || typeof raw !== "object") throw new ApiError(400, "分组格式不正确");
    const value = raw as Record<string, unknown>;
    const id = boundedText(value.id, "分组编号", 80, true);
    const title = boundedText(value.title, "分组名称", 120);
    const x = Number(value.x); const y = Number(value.y); const width = Number(value.width); const height = Number(value.height);
    if (![x, y, width, height].every(Number.isFinite) || Math.abs(x) > 100_000 || Math.abs(y) > 100_000 || width < 260 || width > 2400 || height < 180 || height > 1800) throw new ApiError(400, "分组尺寸不正确");
    if (groupIds.has(id)) continue;
    groupIds.add(id); groups.push({ id, title, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  }
  const excludedItemIds = [...new Set(rawExcluded.map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 200);
  if (excludedItemIds.length) {
    const owned = await getDb().select({ id: readingItems.id }).from(readingItems).where(and(eq(readingItems.ownerId, ownerId), inArray(readingItems.id, excludedItemIds)));
    if (owned.length !== excludedItemIds.length) throw new ApiError(403, "画布中包含无权访问的灵感");
  }
  const validGroupIds = new Set(groups.map(group => group.id));
  const normalizedNodes = nodes.map(node => node.groupId && !validGroupIds.has(node.groupId) ? { ...node, groupId: undefined } : node);
  return { nodes: normalizedNodes, edges, notes, groups, excludedItemIds };
}

function parseStoredLayout(value: string): CanvasLayout {
  try {
    const parsed = JSON.parse(value) as Partial<CanvasLayout>;
    return Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) ? { nodes: parsed.nodes, edges: parsed.edges, notes: Array.isArray(parsed.notes) ? parsed.notes : [], groups: Array.isArray(parsed.groups) ? parsed.groups : [], excludedItemIds: Array.isArray(parsed.excludedItemIds) ? parsed.excludedItemIds : [] } : emptyLayout();
  } catch { return emptyLayout(); }
}
