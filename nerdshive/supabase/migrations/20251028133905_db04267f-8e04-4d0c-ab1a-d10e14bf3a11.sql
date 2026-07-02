-- Enable realtime for checkins and plans tables
ALTER TABLE public.checkins REPLICA IDENTITY FULL;
ALTER TABLE public.plans REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plans;