import { Reveal } from "@/components/Reveal";
import { Board } from "@/components/leaderboard/Board";

export default function LeaderboardPage() {
  return (
    <section style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal><p className="eyebrow" style={{ marginBottom: 18 }}>board</p></Reveal>
        <Reveal><Board /></Reveal>
      </div>
    </section>
  );
}
