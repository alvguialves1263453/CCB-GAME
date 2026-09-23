import React, { useState } from "react";
import { Cloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { imageKitService } from "../services/imageKitService";

export const ImageKitTestButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  const test = async () => {
    setStatus("loading");
    setMsg("Testando conexão...");
    const res = await imageKitService.testConnection();
    if (res.success) {
      setStatus("success");
      setMsg(res.message + (res.endpoint ? ` • ${res.endpoint}` : ""));
    } else {
      setStatus("error");
      setMsg(res.error || res.message);
    }
    setTimeout(() => { setStatus("idle"); setMsg(""); }, 6000);
  };

  if (compact) {
    return (
      <button onClick={test} disabled={status==="loading"} className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold ${status==="success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : status==="error" ? "bg-red-50 border-red-200 text-red-700" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-violet-600 shadow-sm"}`}>
        {status==="loading" ? <Loader2 className="w-4 h-4 animate-spin"/> : status==="success" ? <CheckCircle2 className="w-4 h-4"/> : status==="error" ? <XCircle className="w-4 h-4"/> : <Cloud className="w-4 h-4"/>}
        {status==="idle" ? "Testar ImageKit" : msg.slice(0,22)}
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status==="success" ? "bg-emerald-500" : status==="error" ? "bg-red-500" : "bg-violet-600"}`}>
          <Cloud className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black uppercase tracking-widest text-slate-800">ImageKit</p>
          <p className="text-[11px] font-semibold text-slate-500 truncate">{status==="idle" ? "https://ik.imagekit.io/isa2koeb2" : msg}</p>
        </div>
      </div>
      <button onClick={test} disabled={status==="loading"} className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-colors ${status==="loading" ? "bg-slate-100 text-slate-400" : "bg-violet-600 hover:bg-violet-700 text-white shadow-md"}`}>
        {status==="loading" ? <><Loader2 className="w-4 h-4 animate-spin"/> Testando...</> : status==="success" ? <><CheckCircle2 className="w-4 h-4"/> Conectado!</> : status==="error" ? <><XCircle className="w-4 h-4"/> Falhou</> : <><Cloud className="w-4 h-4"/> Testar Conexão</>}
      </button>
      {msg && status!=="idle" && <p className={`text-xs font-semibold text-center break-all ${status==="success" ? "text-emerald-600" : status==="error" ? "text-red-600" : "text-slate-500"}`}>{msg}</p>}
    </div>
  );
};
