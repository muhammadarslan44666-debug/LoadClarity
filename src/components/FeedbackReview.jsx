import React, { useEffect, useState } from 'react';
import { MessageSquareHeart, Star, Send, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const STORAGE_KEY = 'loadclarity-user-reviews-v1';
export function readReviews() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && Number(item.rating) >= 1 && Number(item.rating) <= 5 && typeof item.comment === 'string') : [];
  } catch { return []; }
}

export function TestimonialsSection() {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    setReviews(readReviews());
    const sync = () => setReviews(readReviews());
    window.addEventListener('storage', sync);
    window.addEventListener('loadclarity:reviews-updated', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('loadclarity:reviews-updated', sync); };
  }, []);
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="reviews-heading">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><MessageSquareHeart className="h-5 w-5" /></div>
        <div><h2 id="reviews-heading" className="font-semibold text-foreground">Feedback & user reviews</h2><p className="text-sm text-muted-foreground">Share your experience and help us improve LoadClarity.</p></div>
      </div>
      {reviews.length ? <div className="grid gap-3 sm:grid-cols-2">
        {reviews.slice(-4).reverse().map((review) => <article key={review.id} className="rounded-xl border border-border p-4">
          <div className="mb-2 flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}</div>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">“{review.comment}”</p>
          <p className="mt-3 text-xs text-muted-foreground">{review.name || 'LoadClarity user'} · {review.date || 'Recently'}</p>
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center"><Quote className="mx-auto mb-2 h-6 w-6 text-muted-foreground"/><p className="text-sm font-medium">Be the first to leave a review</p><p className="mt-1 text-xs text-muted-foreground">Reviews you submit on this device will appear here.</p></div>}
    </section>
  );
}

export default function FeedbackReview({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    if (!rating) { setError('Please select a star rating.'); return; }
    if (comment.trim().length < 8) { setError('Please add a little more detail (at least 8 characters).'); return; }
    const reviews = readReviews();
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, rating, name: name.trim().slice(0, 80), comment: comment.trim().slice(0, 1500), date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...reviews, entry].slice(-100)));
      window.dispatchEvent(new Event('loadclarity:reviews-updated'));
      setSubmitted(true); setError(''); setRating(0); setName(''); setComment('');
    } catch { setError('Could not save feedback in this browser. Please check your browser storage settings.'); }
  };
  const handleOpenChange = (value) => { setOpen(value); if (!value) { setSubmitted(false); setError(''); } };
  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild><Button variant={compact ? 'ghost' : 'outline'} size={compact ? 'sm' : 'default'}><MessageSquareHeart className="h-4 w-4" />{compact ? 'Feedback' : 'Feedback & review'}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      {submitted ? <><DialogHeader><DialogTitle>Thanks for your feedback!</DialogTitle><DialogDescription>Your review has been saved on this device and is now shown in the user reviews section.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter></> : <>
        <DialogHeader><DialogTitle>Feedback & review</DialogTitle><DialogDescription>Rate your experience with LoadClarity and tell us what worked well or what we can improve.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset><legend className="mb-2 text-sm font-medium">Your rating <span className="text-destructive">*</span></legend><div className="flex gap-1" role="radiogroup" aria-label="Rating from one to five stars">{[1,2,3,4,5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} onClick={() => { setRating(value); setError(''); }} className="rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Star className={`h-7 w-7 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} /></button>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="review-name">Name (optional)</Label><Input id="review-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name or company" /></div>
          <div className="space-y-2"><Label htmlFor="review-comment">Your comments <span className="text-destructive">*</span></Label><Textarea id="review-comment" required minLength={8} maxLength={1500} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us about your experience…" /><p className="text-right text-xs text-muted-foreground">{comment.length}/1500</p></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit"><Send className="h-4 w-4" /> Submit review</Button></DialogFooter>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}
