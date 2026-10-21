import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareHeart } from 'lucide-react';
import FeedbackReview, { TestimonialsSection } from '@/components/FeedbackReview';

export default function FeedbackPage() {
  return (
    <main className="min-h-[65vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Back to LoadClarity</Link>
        <header className="mb-6 mt-5">
          <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-3 text-primary"><MessageSquareHeart className="h-6 w-6" /></div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback & Reviews</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Tell us what is working, what needs improvement, and how LoadClarity can better support your dispatch workflow.</p>
          <div className="mt-5"><FeedbackReview /></div>
        </header>
        <TestimonialsSection />
        <p className="mt-6 text-sm text-muted-foreground">Feedback and reviews submitted here are saved in this browser only; they are not sent to LoadClarity or shared across devices.</p>
      </div>
    </main>
  );
}
