import { Reveal } from "@/components/Reveal";
import { Notes } from "@/components/notes/Notes";

export default function NotesPage() {
  return (
    <section style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal><p className="eyebrow" style={{ marginBottom: 18 }}>notes</p></Reveal>
        <Reveal><Notes /></Reveal>
      </div>
    </section>
  );
}
