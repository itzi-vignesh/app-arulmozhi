import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminCredentialsRequest {
  email: string;
  password: string;
  adminName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, adminName }: AdminCredentialsRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Create Supabase client for auth operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Send magic link to the new admin
    const { error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?type=invite&redirect_to=${encodeURIComponent(Deno.env.get('SITE_URL') ?? 'http://localhost:5173')}/login`
    });

    if (authError) {
      console.error('Error sending invite:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Log the successful invitation
    console.log(`Admin invitation sent to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Admin invitation sent to ${email}. They will receive a magic link to set up their account.`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in send-admin-credentials function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);