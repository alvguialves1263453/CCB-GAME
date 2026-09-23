import React from "react";
import { cn } from "../lib/utils";

const LOCAL_BASE = "/ccb/";
const AVATAR_BASE_URL = LOCAL_BASE;

interface AvatarProps {
  url: string;
  size?: number;
  className?: string;
  selected?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ url, size = 120, className, selected }) => {
  const isDataUrl = url.startsWith("data:");
  const isHttp = url.startsWith("http");
  const fullUrl = isDataUrl || isHttp ? url : (url.includes('/') ? `${AVATAR_BASE_URL}${url}` : `${AVATAR_BASE_URL}${url}`);
  // WebP gerado lado a lado (q92): navegador usa WebP (~93% menor), PNG fica de fallback.
  const webpUrl = !isDataUrl && !isHttp && fullUrl.endsWith('.png') ? fullUrl.slice(0, -4) + '.webp' : null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center bg-slate-100 rounded-2xl border-2 border-slate-200 overflow-hidden transition-all duration-200",
        selected && "border-indigo-500 ring-4 ring-indigo-500/20 scale-105 shadow-lg shadow-indigo-500/20",
        !selected && "shadow-md shadow-slate-900/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {webpUrl ? (
        <picture className="w-full h-full contents">
          <source srcSet={webpUrl} type="image/webp" />
          <img
            src={fullUrl}
            alt="Avatar"
            width={size}
            height={size}
            className="w-full h-full object-cover scale-[1.1]"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${url}`;
            }}
          />
        </picture>
      ) : (
        <img
          src={fullUrl}
          alt="Avatar"
          width={size}
          height={size}
          className="w-full h-full object-cover scale-[1.1]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${url}`;
          }}
        />
      )}
    </div>
  );
};
