import type { Resource } from "@/lib/data";
import { GitHub, YouTube, Play, FileDoc, Code, Globe } from "./icons";

function IconFor({ url, type }: { url: string; type: string }) {
  const u = url.toLowerCase();
  if (u.includes("github.com")) return <GitHub size={14} className="res-ico" />;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return <YouTube size={14} className="res-ico" />;
  if (u.includes("arxiv.org") || type === "paper") return <FileDoc size={14} className="res-ico" />;
  if (type === "video") return <Play size={13} className="res-ico" />;
  if (type === "code") return <Code size={14} className="res-ico" />;
  return <Globe size={14} className="res-ico" />;
}

export function ResLink({ res }: { res: Resource }) {
  return (
    <a className="res" href={res.url} target="_blank" rel="noopener noreferrer">
      <IconFor url={res.url} type={res.type} />
      <span>{res.label}</span>
    </a>
  );
}
