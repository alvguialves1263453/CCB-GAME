import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface OnlinePlayer {
  id: string;
  nickname: string;
  avatar?: string;
  status: string;
  statusDetail: string;
  view: string;
  gameType?: string;
  device?: string;
  onlineAt: number;
}

function getDeviceLabel(): string {
  try {
    const ua = navigator.userAgent;
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
    if (/iPhone/i.test(ua)) return "iPhone • iOS";
    if (/iPad/i.test(ua)) return "iPad • iOS";
    if (/Android/i.test(ua)) {
      if (/Mobile/i.test(ua)) return "Android • Celular";
      return "Android • Tablet";
    }
    if (/Windows/i.test(ua)) return "PC • Windows";
    if (/Mac/i.test(ua) || platform.includes("Mac")) return "Mac • macOS";
    if (/Linux/i.test(ua)) return "PC • Linux";
    return "Navegador";
  } catch { return "Dispositivo"; }
}

let channel: RealtimeChannel | null = null;
let dbChannel: RealtimeChannel | null = null;
let presenceId: string | null = null;
let onUpdate: ((players: OnlinePlayer[]) => void) | null = null;
let currentProfile: { nickname: string; avatarUrl: string } | null = null;
let currentView: string = "home";
let currentGameType: string = "lobby";
let heartbeat: any = null;
let pollInterval: any = null;

function getStatus(view: string, gameType?: string): { status: string; detail: string } {
  if (view === "home") return { status: " No lobby", detail: "No menu inicial" };
  if (view === "mode_selection") return { status: " Escolhendo modo", detail: "Escolhendo modo de jogo" };
  if (view === "multiplayer_menu") return { status: " No lobby", detail: "Procurando sala" };
  if (view === "multiplayer_setup") {
    if (gameType === "biblia") return { status: " Criando sala", detail: "Quiz da Bíblia" };
    return { status: " Criando sala", detail: "Qual é o Hino?" };
  }
  if (view === "multiplayer_join") return { status: " Entrando", detail: "Entrando na sala" };
  if (view === "lobby") return { status: " Na sala", detail: gameType === "biblia" ? "Aguardando - Bíblia" : "Aguardando - Hino" };
  if (view === "game") {
    if (gameType === "biblia") return { status: " Jogando", detail: "Quiz da Bíblia" };
    if (gameType === "drawing") return { status: " Jogando", detail: "Desenhe a Palavra" };
    return { status: " Jogando", detail: "Qual é o Hino?" };
  }
  if (view.startsWith("biblia")) {
    if (view === "biblia_lobby") return { status: " Na sala", detail: "Bíblia - Lobby" };
    if (view === "biblia_game") return { status: " Jogando", detail: "Quiz da Bíblia" };
    if (view === "biblia_ranking") return { status: " No ranking", detail: "Bíblia" };
  }
  if (view.startsWith("drawing")) {
    if (view === "drawing_lobby") return { status: " Na sala", detail: "Desenho - Lobby" };
    if (view === "drawing_game") return { status: " Jogando", detail: "Desenhe a Palavra" };
    return { status: " Jogando", detail: "Desenho" };
  }
  if (view === "ranking") return { status: " No ranking", detail: gameType || "Hino" };
  if (view === "hymn_list") return { status: " Vendo hinos", detail: "Lista de hinos" };
  return { status: " Online", detail: view };
}

function mapPresences(): OnlinePlayer[] {
  if (!channel) return [];
  const state = channel.presenceState<any>();
  const players: OnlinePlayer[] = [];
  for (const key in state) {
    const presences = state[key] as any[];
    const p = presences[presences.length - 1] as any;
    const data = p.nickname ? p : (p.presence || p);
    const actual = (data as any).nickname ? data : ((data as any).payload || data);
    const d = (actual as any).nickname ? actual : p;
    const nickname = d.nickname || p.nickname || "Jogador";
    const avatar = d.avatar || p.avatar;
    const status = d.status || p.status || " Online";
    const statusDetail = d.statusDetail || p.statusDetail || "";
    players.push({
      id: key,
      nickname,
      avatar,
      status,
      statusDetail,
      view: d.view || p.view || "home",
      gameType: d.gameType || p.gameType,
      onlineAt: d.onlineAt || p.onlineAt || Date.now(),
    });
  }
  return players.sort((a, b) => a.nickname.localeCompare(b.nickname));
}

async function fetchDbPresence(): Promise<OnlinePlayer[]> {
  const { data, error } = await supabase.from("online_presence").select("*");
  if (error) {
    console.error("[Presence] fetch ERRO:", error.message, (error as any).details, (error as any).hint, JSON.stringify(error));
    try { (window as any).presenceLastError = error.message; } catch {}
    return [];
  }
  if (!data) {
    console.warn("[Presence] fetch vazio");
    try { (window as any).presenceLastError = "vazio"; } catch {}
    return [];
  }
  console.log("[Presence] fetch OK:", data.length, "linhas", data.map((r:any)=> r.id.slice(0,6)+":"+r.nickname+":"+new Date(r.updated_at).toISOString().slice(11,19)));
  try { (window as any).presenceLastFetch = data.length + " - " + data.map((r:any)=>r.nickname).join(","); } catch {}
  // Filtra stale de verdade (30s sem heartbeat = offline) - sem fallback que mantinha fantasma
  const cutoff = Date.now() - 35 * 1000;
  const filtered = data.filter((r:any) => {
    if (!r.updated_at) return true;
    const age = Date.now() - new Date(r.updated_at).getTime();
    return age < 35 * 1000;
  });
  // Limpa fantasmas antigos no DB (fire-and-forget)
  if (data.length !== filtered.length) {
    const staleIds = data.filter((r:any) => Date.now() - new Date(r.updated_at).getTime() >= 35 * 1000).map((r:any)=>r.id);
    if (staleIds.length) {
      supabase.from("online_presence").delete().in("id", staleIds).then(()=>console.log("[Presence] limpou stale:", staleIds.length));
    }
  }
  return filtered.map((row: any) => ({
    id: row.id,
    nickname: row.nickname || "Jogador",
    avatar: row.avatar,
    status: row.status || " Online",
    statusDetail: row.status_detail || "",
    view: row.view || "home",
    gameType: row.game_type,
    device: row.device || undefined,
    onlineAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

async function upsertDbPresence() {
  // Garante id mesmo se getPresenceId falhou antes (evita null violates not-null)
  if (!presenceId) {
    try { presenceService.getPresenceId(); } catch {}
    if (!presenceId) presenceId = Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
  }
  const id = presenceId!;
  const { status: s, detail } = getStatus(currentView, currentGameType);
  const device = getDeviceLabel();
  // device é só pra log, não envia pro DB pra evitar 400 quando coluna não existe (presenca_fix.txt sem device)
  const payload: any = {
    id,
    nickname: currentProfile?.nickname || "Jogador",
    avatar: currentProfile?.avatarUrl || "irmaos/1.png",
    status: s,
    status_detail: detail,
    view: currentView,
    game_type: currentGameType,
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase.from("online_presence").upsert(payload, { onConflict: "id" }).select();
  if (error) {
    console.error("[Presence] upsert ERRO:", error.message, (error as any).details, (error as any).hint, "payload:", payload);
    if (error.message?.includes("row-level security") || (error as any).code === "42501") {
      console.error("[Presence] RLS bloqueando! Rode: ALTER TABLE online_presence DISABLE ROW LEVEL SECURITY;");
    }
    if (error.message?.includes("does not exist")) {
      console.warn("[Presence] Tabela online_presence não existe. Rode supabase_presence.sql");
    }
  } else {
    console.log("[Presence] upsert OK:", data?.[0]?.id, payload.nickname, device);
  }
  return { data, error };
}

async function refreshDbAndNotify() {
  const players = await fetchDbPresence();
  const chPlayers = channel ? mapPresences() : [];
  console.log("[Presence] refresh - DB:", players.length, "Channel:", chPlayers.length, "DB ids:", players.map(p=>p.id.slice(0,6)+":"+p.nickname), "CH ids:", chPlayers.map(p=>p.id.slice(0,6)+":"+p.nickname));
  const merged = new Map<string, OnlinePlayer>();
  for (const p of [...players, ...chPlayers]) {
    if (!merged.has(p.id)) merged.set(p.id, p);
    else {
      const cur = merged.get(p.id)!;
      if (p.onlineAt > cur.onlineAt) merged.set(p.id, p);
    }
  }
  const finalList = Array.from(merged.values()).sort((a,b)=>a.nickname.localeCompare(b.nickname));
  console.log("[Presence] finalList:", finalList.length, finalList.map(p=>p.id.slice(0,6)+":"+p.nickname+":"+p.status));
  // expõe pra debug no window
  try { (window as any).presenceDebug = { db: players, ch: chPlayers, final: finalList, presenceId }; } catch {}
  onUpdate?.(finalList);
}

export const presenceService = {
  getPresenceId(): string {
    if (presenceId) return presenceId;
    // Usa sessionStorage pra cada aba ter ID único (localStorage compartilhava e duplicava)
    // Robusto: se sessionStorage bloqueado (Brave/iframe/privado) cai no fallback memória
    let id: string | null = null;
    try { id = sessionStorage.getItem("ccb_presence_id"); } catch {}
    if (!id) {
      id = Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,6);
      try { sessionStorage.setItem("ccb_presence_id", id); } catch {}
    }
    presenceId = id;
    return id;
  },

  async init(
    profile: { nickname: string; avatarUrl: string },
    view: string,
    gameType: string,
    onPlayersChange: (players: OnlinePlayer[]) => void
  ) {
    currentProfile = profile;
    currentView = view;
    currentGameType = gameType;
    onUpdate = onPlayersChange;

    const id = this.getPresenceId();
    if (channel) {
      try { await supabase.removeChannel(channel); } catch {}
      channel = null;
    }
    if (dbChannel) {
      try { await supabase.removeChannel(dbChannel); } catch {}
      dbChannel = null;
    }
    if (heartbeat) clearInterval(heartbeat);
    if (pollInterval) clearInterval(pollInterval);

    // 1) Canal Presence (rápido, mas pode falhar no 192.168 -> usamos DB como fonte principal)
    channel = supabase.channel("global-presence", {
      config: { presence: { key: id } },
    });
    const { status: s, detail } = getStatus(view, gameType);
    const device = getDeviceLabel();
    channel
      .on("presence", { event: "sync" }, () => refreshDbAndNotify())
      .on("presence", { event: "join" }, () => refreshDbAndNotify())
      .on("presence", { event: "leave" }, () => refreshDbAndNotify());
    await new Promise<void>((resolve) => {
      channel!.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel!.track({
            nickname: profile.nickname || "Jogador",
            avatar: profile.avatarUrl || "irmaos/1.png",
            status: s,
            statusDetail: detail,
            view,
            gameType,
            device,
            onlineAt: Date.now(),
          });
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolve();
        }
      });
      setTimeout(() => resolve(), 3000);
    });

    // 2) Tabela online_presence (confiável para 192.168.0.112:3000 <-> localhost)
    await upsertDbPresence().catch(()=>{});
    // Subscribe a mudanças na tabela
    dbChannel = supabase.channel("online-presence-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "online_presence" }, () => refreshDbAndNotify())
      .subscribe();
    await refreshDbAndNotify();

    // Heartbeat DB a cada 10s + poll fallback a cada 3s
    heartbeat = setInterval(() => { upsertDbPresence().catch(()=>{}); }, 10000);
    pollInterval = setInterval(() => { refreshDbAndNotify().catch(()=>{}); }, 3000);

    // Cleanup confiável no mobile (iPhone/Android fecham sem beforeunload)
    const doDestroy = () => { try { (presenceService as any).destroy(); } catch {} };
    (window as any)._presencePageHide = doDestroy;
    (window as any)._presenceVisibility = () => { if (document.visibilityState === "hidden") doDestroy(); };
    (window as any)._presenceBeforeUnload = doDestroy;
    window.addEventListener("pagehide", (window as any)._presencePageHide);
    window.addEventListener("visibilitychange", (window as any)._presenceVisibility);
    window.addEventListener("beforeunload", (window as any)._presenceBeforeUnload);
  },

  async update(profile?: { nickname: string; avatarUrl: string }, view?: string, gameType?: string) {
    if (profile) currentProfile = profile;
    if (view) currentView = view;
    if (gameType !== undefined) currentGameType = gameType;
    const { status: s, detail } = getStatus(currentView, currentGameType);
    const device = getDeviceLabel();
    if (channel) {
      try {
        await channel.track({
          nickname: currentProfile?.nickname || "Jogador",
          avatar: currentProfile?.avatarUrl || "irmaos/1.png",
          status: s,
          statusDetail: detail,
          view: currentView,
          gameType: currentGameType,
          device,
          onlineAt: Date.now(),
        });
      } catch {}
    }
    try { await upsertDbPresence(); } catch {}
    try { await refreshDbAndNotify(); } catch {}
  },

  async destroy() {
    if (heartbeat) clearInterval(heartbeat);
    if (pollInterval) clearInterval(pollInterval);
    heartbeat = null; pollInterval = null;
    const id = presenceId;
    if (id) {
      // Tenta deletar de 3 jeitos (um vai pegar mesmo no iPhone fechando)
      try { await supabase.from("online_presence").delete().eq("id", id); } catch {}
      try {
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const apikey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && apikey) {
          // sendBeacon é mais confiável no mobile que fetch keepalive
          const url = `${supabaseUrl}/rest/v1/online_presence?id=eq.${id}`;
          const headers = { apikey, Authorization: `Bearer ${apikey}` } as any;
          if (navigator.sendBeacon) {
            try {
              const blob = new Blob([], { type: "application/json" });
              // postgrest delete via beacon precisa de método DELETE, mas sendBeacon só faz POST - usa fetch keepalive como fallback
              fetch(url, { method: "DELETE", headers, keepalive: true } as any).catch(()=>{});
            } catch {}
          } else {
            fetch(url, { method: "DELETE", headers, keepalive: true } as any).catch(()=>{});
          }
        }
      } catch {}
      // Limpa presenceId pra próxima sessão gerar novo
      try { sessionStorage.removeItem("ccb_presence_id"); } catch {}
      presenceId = null;
    }
    if (channel) { try { await supabase.removeChannel(channel); } catch {} channel = null; }
    if (dbChannel) { try { await supabase.removeChannel(dbChannel); } catch {} dbChannel = null; }
    onUpdate = null;
    // Remove listeners
    try {
      window.removeEventListener("pagehide", (window as any)._presencePageHide);
      window.removeEventListener("visibilitychange", (window as any)._presenceVisibility);
      window.removeEventListener("beforeunload", (window as any)._presenceBeforeUnload);
    } catch {}
  },

  // For manual refresh (usado no botão ↻)
  async refresh() {
    await refreshDbAndNotify();
  },
  getOnlinePlayers(): OnlinePlayer[] {
    return mapPresences();
  },
};
