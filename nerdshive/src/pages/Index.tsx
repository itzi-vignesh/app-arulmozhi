import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hexagon, ArrowRight, Users, Shield, Calendar } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          <div className="mx-auto w-24 h-24 bg-background rounded-3xl flex items-center justify-center shadow-card">
            <img src="/lovable-uploads/b5bf5e7b-0484-4b8f-9578-5196aeeeff75.png" alt="Nerdshive" className="w-16 h-16" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-foreground">
              Welcome to Nerdshive
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Collaborate locally, impact globally. Join our vibrant coworking community designed for tech professionals and innovators.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/register")}
              size="lg"
              className="gradient-primary hover:shadow-primary transition-smooth"
            >
              Join Nerdshive
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={() => navigate("/company-register")}
              size="lg"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10 transition-smooth"
            >
              Register Company
              <Users className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={() => navigate("/login")}
              variant="ghost"
              size="lg"
              className="transition-smooth"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <Card className="shadow-card text-center">
            <CardHeader>
              <Calendar className="w-12 h-12 mx-auto text-primary mb-4" />
              <CardTitle>Flexible Plans</CardTitle>
              <CardDescription>
                Day, weekly, or monthly passes to fit your schedule
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="shadow-card text-center">
            <CardHeader>
              <Users className="w-12 h-12 mx-auto text-primary mb-4" />
              <CardTitle>Community</CardTitle>
              <CardDescription>
                Connect with like-minded professionals and innovators
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="shadow-card text-center">
            <CardHeader>
              <Shield className="w-12 h-12 mx-auto text-primary mb-4" />
              <CardTitle>Secure & Approved</CardTitle>
              <CardDescription>
                Admin-approved members ensure a professional environment
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
