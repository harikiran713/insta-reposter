import InstagramConnect from "@/components/InstagramConnect";
import ReelForm from "@/components/ReelForm";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl space-y-8 rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl shadow-indigo-950/40 sm:p-10">
        <h1 className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-center text-3xl font-bold text-transparent sm:text-4xl">
          Instagram Reel Reposter
        </h1>
        <InstagramConnect>
          <ReelForm />
        </InstagramConnect>
      </div>
    </main>
  );
}
