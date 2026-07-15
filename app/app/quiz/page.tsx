import { Suspense } from "react";
import { Quiz } from "@/components/quiz/Quiz";

export default function QuizPage() {
  return (
    <section style={{ paddingTop: 48, minHeight: "70vh" }}>
      <div className="wrap">
        <Suspense fallback={<p className="eyebrow">Loading quiz</p>}>
          <Quiz />
        </Suspense>
      </div>
    </section>
  );
}
