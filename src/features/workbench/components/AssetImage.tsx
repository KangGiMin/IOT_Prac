import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { ComponentAsset, Size } from "../../../types/circuit";

/** Never substitutes a drawn device: a missing photograph is an explicit placeholder. */
export function AssetImage({
  asset,
  thumbnail = false,
  onLoad,
  onFallback,
}: {
  asset: ComponentAsset;
  thumbnail?: boolean;
  onLoad?: (natural: Size) => void;
  onFallback?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === asset.src)
    return (
      <div className={`photo-fallback ${thumbnail ? "is-thumbnail" : ""}`}>
        <ImageOff
          size={thumbnail ? 20 : 26}
          strokeWidth={1.3}
          aria-hidden="true"
        />
        {!thumbnail && (
          <>
            <strong>{asset.label}</strong>
            <span>{asset.fileName}</span>
            <small>PNG 에셋 대기 중</small>
          </>
        )}
      </div>
    );
  return (
    <img
      className="asset-photo"
      src={asset.src}
      alt={asset.label}
      draggable={false}
      onError={() => {
        setFailedSrc(asset.src);
        onFallback?.();
      }}
      onLoad={(event) =>
        onLoad?.({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      }
    />
  );
}
