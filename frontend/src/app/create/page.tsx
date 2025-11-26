import { CreatePollForm } from "@/components/polls/CreatePollForm";

export default function CreatePollPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create a Poll</h1>
        <p className="text-gray-400 mt-1">
          Create a new poll for 10 mVote
        </p>
      </div>

      <CreatePollForm />
    </div>
  );
}
