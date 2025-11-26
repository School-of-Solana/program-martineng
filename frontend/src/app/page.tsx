import { PollList } from "@/components/polls/PollList";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Active Polls</h1>
          <p className="text-gray-400 mt-1">
            Vote on polls or create your own
          </p>
        </div>
        <Link
          href="/create"
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition"
        >
          Create Poll
        </Link>
      </div>

      <PollList />
    </div>
  );
}
