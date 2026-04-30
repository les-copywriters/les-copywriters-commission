import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const PasswordResetPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInvite, setIsInvite] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Detect whether this is a new user invite or a password reset
    const hash = window.location.hash;
    if (hash.includes("type=invite")) setIsInvite(true);

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!hash || !hash.includes("access_token")) {
          setError("Invalid or expired link. Please request a new one.");
        }
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully");
        // Sign out after reset to force a fresh login
        await supabase.auth.signOut();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -ml-40 -mb-40" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      <div className="w-full max-w-[450px] relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-10 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-white shadow-2xl shadow-primary/20 overflow-hidden border border-white/10">
            <img src="/Les Copywriters Logo.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isInvite ? "Welcome — Set Your Password" : "Set New Password"}
            </h1>
            <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              {isInvite ? "Create your account password" : "Security Update"}
            </p>
          </div>
        </div>

        <Card className="border-none shadow-premium rounded-[2.5rem] bg-background/95 backdrop-blur-xl overflow-hidden">
          <CardContent className="p-10">
            {success ? (
              <div className="space-y-8 py-4">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black">
                      {isInvite ? "Account Ready!" : "Password Changed"}
                    </h3>
                    <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                      {isInvite
                        ? "Your account has been set up. Log in with your email and new password to get started."
                        : "Your password has been updated. You can now log in with your new credentials."}
                    </p>
                  </div>
                </div>
                <Button 
                  className="w-full h-14 rounded-2xl text-[13px] font-black uppercase tracking-[0.15em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  onClick={() => navigate("/")}
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-8">
                {error && (
                  <div className="rounded-[1.5rem] bg-rose-500/5 border border-rose-500/10 p-4 flex items-center gap-3 animate-in shake duration-500">
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    <p className="text-sm font-bold text-rose-500 leading-tight">{error}</p>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">New Password</Label>
                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary pointer-events-none" />
                      <Input 
                        type="password" 
                        className="pl-12 h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="••••••••" 
                        required 
                        disabled={!!error && error.includes("Invalid or expired")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Confirm New Password</Label>
                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary pointer-events-none" />
                      <Input 
                        type="password" 
                        className="pl-12 h-14 rounded-2xl border-2 bg-muted/20 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-medium" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        placeholder="••••••••" 
                        required 
                        disabled={!!error && error.includes("Invalid or expired")}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl text-[13px] font-black uppercase tracking-[0.15em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" 
                    disabled={loading || (!!error && error.includes("Invalid or expired"))}
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                  
                  {error && error.includes("Invalid or expired") && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs gap-2 mt-4" 
                      onClick={() => navigate("/")}
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Login
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-center text-muted-foreground/40 pt-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em]">Secure End-to-End Encryption</span>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-white/20 mt-10">
          © {new Date().getFullYear()} Les CopyWriters Global Security
        </p>
      </div>
    </div>
  );
};

export default PasswordResetPage;
