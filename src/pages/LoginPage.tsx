import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Mail } from "lucide-react";

/** Login page — mocked authentication. Replace with real API later. */
const LoginPage = () => {
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("demo");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Lock className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Sales Tracker</CardTitle>
          <CardDescription>Connectez-vous pour accéder au tableau de bord</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full">Se connecter</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
