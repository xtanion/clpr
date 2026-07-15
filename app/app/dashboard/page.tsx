import { Reveal } from "@/components/Reveal";
import { Board3D } from "@/components/Board3D";
import { Greeting } from "@/components/dashboard/Greeting";
import { Objective } from "@/components/dashboard/Objective";
import { CheckInForm } from "@/components/dashboard/CheckInForm";

export default function DashboardPage() {
  return (
    <>
      <section style={{ paddingTop: 24, paddingBottom: 8 }}>
        <div className="wrap">
          <Reveal><Greeting /></Reveal>
          <Reveal><Board3D /></Reveal>
        </div>
      </section>

      <section style={{ paddingTop: 8 }}>
        <div className="wrap"><Reveal><Objective /></Reveal></div>
      </section>

      <section style={{ paddingTop: 24 }}>
        <div className="wrap"><Reveal><CheckInForm /></Reveal></div>
      </section>
    </>
  );
}
