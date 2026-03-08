import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Landmark, Calendar, Home, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface HistoricalImage {
  url: string;
  description: string;
}

interface LocationInfo {
  facts: string[];
  historicalFacts: string[];
  events: Array<{ title: string; date: string; description: string }>;
  realEstate: Array<{ address: string; price: string; type: string; link: string }>;
  historicalImage: HistoricalImage | null;
}

interface InfoPanelProps {
  info: LocationInfo | null;
  isLoading: boolean;
}

export function InfoPanel({ info, isLoading }: InfoPanelProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Gathering information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Ask me about this location to get started!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <CardTitle>Location Information</CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto h-[calc(100%-5rem)]">
        <Tabs defaultValue="facts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="facts">
              <Landmark className="w-4 h-4 mr-2" />
              Facts
            </TabsTrigger>
            <TabsTrigger value="events">
              <Calendar className="w-4 h-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="realestate">
              <Home className="w-4 h-4 mr-2" />
              Real Estate
            </TabsTrigger>
            <TabsTrigger value="historical">
              <ImageIcon className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facts" className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Fun Facts</h3>
              <ul className="space-y-2">
                {info.facts.map((fact, idx) => (
                  <li key={idx} className="text-sm">• {fact}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Historical Facts</h3>
              <ul className="space-y-2">
                {info.historicalFacts.map((fact, idx) => (
                  <li key={idx} className="text-sm">• {fact}</li>
                ))}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {info.events.length > 0 ? (
              info.events.map((event, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{event.date}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{event.description}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming events found in this area.</p>
            )}
          </TabsContent>

          <TabsContent value="realestate" className="space-y-4">
            {info.realEstate.length > 0 ? (
              info.realEstate.map((listing, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-base">{listing.address}</CardTitle>
                    <p className="text-sm text-muted-foreground">{listing.type}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold text-primary mb-2">{listing.price}</p>
                    <a
                      href={listing.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Details →
                    </a>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No real estate listings found in this area.</p>
            )}
          </TabsContent>

          <TabsContent value="historical" className="space-y-4">
            {info.historicalImage ? (
              <div>
                <ImageWithFallback
                  src={info.historicalImage.url}
                  alt="Historical rendering"
                  className="w-full rounded-lg mb-4"
                />
                <p className="text-sm">{info.historicalImage.description}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No historical image available for this location.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
