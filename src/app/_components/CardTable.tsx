"use client";
import { trpc } from "../_trpc/client";

export default function Todolist() {
  const getTarotFortune = trpc.getTodos.useQuery();
  console.log("getTarotFortune: ", getTarotFortune);

  return (
    <div>
      <div>Test!</div>
      <div>{JSON.stringify(getTarotFortune.data)}</div>
    </div>
  );
}
