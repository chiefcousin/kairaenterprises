"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  title: string | null;
  review: string | null;
  created_at: string;
}

interface ReviewSummary {
  reviews: Review[];
  average: number;
  count: number;
}

function StarRating({
  rating,
  onRate,
  size = "md",
}: {
  rating: number;
  onRate?: (r: number) => void;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const px = size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate}
          className={onRate ? "cursor-pointer" : "cursor-default"}
          onMouseEnter={() => onRate && setHover(star)}
          onMouseLeave={() => onRate && setHover(0)}
          onClick={() => onRate?.(star)}
        >
          <Star
            className={`${px} ${
              star <= (hover || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingSummary({ average, count }: { average: number; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-bold">{average.toFixed(1)}</span>
      <div>
        <StarRating rating={Math.round(average)} size="sm" />
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "review" : "reviews"}
        </p>
      </div>
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [review, setReview] = useState("");

  const fetchReviews = useCallback(async () => {
    const res = await fetch(`/api/reviews?product_id=${productId}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    // Get customer phone from localStorage signup data
    const isRegistered = localStorage.getItem("ka_customer_registered");
    if (!isRegistered) {
      setError("Please sign up before leaving a review");
      return;
    }

    // We need the customer phone - fetch from profile
    setSubmitting(true);
    try {
      // Get customer phone from the profile page's stored data
      const phone = localStorage.getItem("ka_customer_phone");
      if (!phone) {
        setError(
          "Could not find your phone number. Please visit your profile to update your details."
        );
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          customer_phone: phone,
          rating,
          title: title.trim() || undefined,
          review: review.trim() || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to submit review");

      setSuccess("Your review has been submitted!");
      setRating(0);
      setTitle("");
      setReview("");
      setShowForm(false);
      fetchReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="mb-6 text-2xl font-bold">Ratings & Reviews</h2>

      {data && data.count > 0 && (
        <RatingSummary average={data.average} count={data.count} />
      )}

      <div className="mt-6">
        {!showForm ? (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            Write a Review
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="max-w-lg space-y-4 rounded-lg border p-4"
          >
            <div className="space-y-2">
              <Label>Your Rating *</Label>
              <StarRating rating={rating} onRate={setRating} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-title">Title (optional)</Label>
              <Input
                id="review-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-body">Review (optional)</Label>
              <Textarea
                id="review-body"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Tell others what you think about this product..."
                rows={4}
                maxLength={1000}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Review
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Reviews List */}
      {data && data.reviews.length > 0 && (
        <div className="mt-8 space-y-6">
          {data.reviews.map((r) => (
            <div key={r.id} className="border-b pb-4 last:border-b-0">
              <div className="flex items-center gap-3">
                <StarRating rating={r.rating} size="sm" />
                {r.title && (
                  <span className="font-semibold">{r.title}</span>
                )}
              </div>
              {r.review && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {r.review}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {r.customer_name || "Customer"} &middot;{" "}
                {new Date(r.created_at).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      {data && data.count === 0 && !showForm && (
        <p className="mt-4 text-sm text-muted-foreground">
          No reviews yet. Be the first to review this product!
        </p>
      )}
    </section>
  );
}
