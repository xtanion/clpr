import { Suspense } from "react";
import { ClimbView } from "@/components/climb/ClimbView";

export default function ClimbPage() {
  return (
    <section style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Suspense fallback={<p className="eyebrow">loading</p>}>
          <ClimbView />
        </Suspense>
      </div>
    </section>
  );
}
