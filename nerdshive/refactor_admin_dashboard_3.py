import re

file_path = 'e:/1/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace apiClient.put(/queries/update, {}).catch(() => {});
content = re.sub(
    r'const handleRespondToQuery = async \(\) => \{.*?\};',
    '''const handleRespondToQuery = async () => {
    if (!selectedQuery || !queryResponse.trim()) return;

    setLoading(true);
    try {
      await dashboardService.updateQuery(selectedQuery.id, { response: queryResponse, status: 'answered' });

      toast({
        title: "Response Sent",
        description: "Query has been responded to successfully.",
        variant: "default"
      });

      setQueryResponse("");
      setSelectedQuery(null);
      fetchQueries();
    } catch (error) {
      console.error('Error responding to query:', error);
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleSaveContent
content = re.sub(
    r'const handleSaveContent = async \(\) => \{.*?\};',
    '''const handleSaveContent = async () => {
    if (!editingContent || !newContent.trim()) return;

    setLoading(true);
    try {
      await dashboardService.updateContentSection(editingContent.section, { content: newContent });

      toast({
        title: "Content Updated",
        description: "Section content has been updated successfully.",
        variant: "default"
      });

      setEditingContent(null);
      setNewContent("");
      fetchContentSections();
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: "Error",
        description: "Failed to update content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleSavePricing
content = re.sub(
    r'const handleSavePricing = async \(\) => \{.*?\};',
    '''const handleSavePricing = async () => {
    if (!editingPricing || !newAmount || !newGstRate) return;

    setLoading(true);
    try {
      await businessService.updatePricing({ 
        plan_type: editingPricing.plan_type, 
        amount: Number(newAmount), 
        gst_rate: Number(newGstRate) 
      });

      toast({
        title: "Pricing Updated",
        description: "Plan pricing has been updated successfully.",
        variant: "default"
      });

      setEditingPricing(null);
      setNewAmount("");
      setNewGstRate("");
      fetchPricing();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast({
        title: "Error",
        description: "Failed to update pricing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };''',
    content,
    flags=re.DOTALL
)

# Replace handleLogout
content = re.sub(
    r'const handleLogout = async \(\) => \{.*?\};',
    '''const handleLogout = async () => {
    try {
      await authService.logout();
      navigate("/login");
    } catch (error) {
      console.error('Error logging out:', error);
      navigate("/login");
    }
  };''',
    content,
    flags=re.DOTALL
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Refactoring 3 applied.")
