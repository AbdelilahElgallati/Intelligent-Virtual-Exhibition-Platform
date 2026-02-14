import React from 'react';
import { Recommendation } from '@/lib/api/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

interface RecommendedEventsProps {
  recommendations: Recommendation[];
  loading: boolean;
}

export const RecommendedEvents: React.FC<RecommendedEventsProps> = ({ recommendations, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center p-6 bg-muted/20 rounded-lg border border-dashed">
        <p className="text-muted-foreground text-sm">No recommendations available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id} className="overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">{rec.title}</CardTitle>
              {rec.score > 0.8 && (
                <Badge variant="secondary" className="text-[10px]">
                  High Match
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {rec.description}
            </p>
            {rec.reason && (
              <p className="text-[10px] text-primary font-medium italic">
                {rec.reason}
              </p>
            )}
          </CardContent>
          <CardFooter className="p-4 pt-0 flex justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link href={`/events/${rec.id}`}>View details</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
