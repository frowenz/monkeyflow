import { useTest } from "../../store/test";

export function ResultPage() {
  const result = useTest((s) => s.result);
  if (!result) return null;
  return (
    <div id="result">
      wpm {Math.round(result.wpm)} acc {Math.floor(result.acc)}%
    </div>
  );
}
