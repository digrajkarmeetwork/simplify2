import { getNeedsReview } from "@/lib/queries/review";
import { ReviewList } from "@/components/review/review-list";

export default async function ReviewPage() {
  const entries = await getNeedsReview();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-sm text-muted-foreground">
          {entries.length === 0
            ? "All caught up."
            : `${entries.length} entr${entries.length === 1 ? "y" : "ies"} need a quick check.`}
        </p>
      </header>
      <ReviewList entries={entries} />
    </div>
  );
}
