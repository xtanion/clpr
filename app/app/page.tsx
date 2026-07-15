import { Reveal } from "@/components/Reveal";
import { Tree } from "@/components/home/Tree";

export default function Home() {
  return (
    <section style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal>
          <p className="eyebrow" style={{ marginBottom: 18 }}>flavours</p>
          <Tree />
        </Reveal>
      </div>
    </section>
  );
}
