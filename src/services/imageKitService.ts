const API_BASE = ""; // mesmo host

export const imageKitService = {
  async testConnection(): Promise<{ success: boolean; message: string; endpoint?: string; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/imagekit-test`);
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error || "Falha", error: data.error };
      return { success: true, message: data.message || "Conectado!", endpoint: data.endpoint };
    } catch (e: any) {
      return { success: false, message: e.message || String(e), error: String(e) };
    }
  },

  async uploadAvatar(dataUrl: string, fileName?: string): Promise<{ url: string; thumbnail?: string; fileId?: string }> {
    const res = await fetch(`${API_BASE}/api/upload-avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, fileName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha no upload ImageKit");
    return data;
  },

  async deleteAvatar(fileId?: string, url?: string): Promise<void> {
    if (!fileId && !url) return;
    // Só deleta se for URL do ImageKit (não apaga avatar padrão irmaos/)
    if (url && !url.includes("ik.imagekit.io")) return;
    try {
      await fetch(`${API_BASE}/api/delete-avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, url }),
      });
    } catch {}
  },

  async getAuthParams(): Promise<{ token: string; expire: number; signature: string }> {
    const res = await fetch(`${API_BASE}/api/imagekit-auth`);
    return res.json();
  }
};
