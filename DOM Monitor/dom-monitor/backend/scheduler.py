from apscheduler.schedulers.background import BackgroundScheduler
from worker import check_monitors

scheduler = BackgroundScheduler()

def start_scheduler():
    """
    Start the background scheduler to run check_monitors every 60 seconds.
    """
    if not scheduler.running:
        print("Starting background scheduler...")
        # Check monitors every 1 second
        scheduler.add_job(
            check_monitors, 
            'interval', 
            seconds=1, 
            id='check_monitors_job', 
            replace_existing=True
        )
        scheduler.start()

def shutdown_scheduler():
    """
    Stop the background scheduler.
    """
    if scheduler.running:
        print("Stopping background scheduler...")
        scheduler.shutdown()
