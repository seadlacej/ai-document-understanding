<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Upload, FileText, Download, Loader2, AlertCircle } from "lucide-svelte";
  import type { Job } from "$lib/server/pocketbase";
  import { onMount, onDestroy } from 'svelte';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: { jobs: any[] };

  let files: File[] = [];
  let isDragging = false;
  let uploading = false;
  let fileInput: HTMLInputElement;
  let pollInterval: ReturnType<typeof setInterval>;

  $: jobs = data.jobs;

  onMount(() => {
    // Poll for updates every 5 seconds
    pollInterval = setInterval(() => {
      invalidate('/api/jobs');
    }, 5000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    
    if (e.dataTransfer?.files) {
      const pptxFiles = Array.from(e.dataTransfer.files).filter(
        file => file.name.endsWith('.pptx')
      );
      files = [...files, ...pptxFiles];
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      const pptxFiles = Array.from(input.files).filter(
        file => file.name.endsWith('.pptx')
      );
      files = [...files, ...pptxFiles];
    }
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  async function uploadFiles() {
    if (files.length === 0) return;
    
    uploading = true;
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
      
      files = [];
      await invalidate('/api/jobs');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      uploading = false;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
</script>

<div class="container mx-auto p-8 max-w-4xl">
  <h1 class="text-4xl font-bold mb-8">PowerPoint Document Analyzer</h1>
  
  <!-- Upload Card -->
  <Card class="mb-8">
    <CardHeader>
      <CardTitle>Upload PowerPoint Files</CardTitle>
      <CardDescription>
        Drag and drop PPTX files or click to browse. Files will be analyzed using AI to extract all content.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center transition-colors
               {isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'}"
        role="region"
        aria-label="File upload area"
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
      >
        <Upload class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p class="text-lg mb-2">Drop PPTX files here or click to browse</p>
        <input
          type="file"
          accept=".pptx"
          multiple
          class="hidden"
          bind:this={fileInput}
          on:change={handleFileSelect}
        />
        <Button variant="outline" on:click={() => fileInput.click()}>
          Select Files
        </Button>
      </div>

      {#if files.length > 0}
        <div class="mt-4 space-y-2">
          <h3 class="font-semibold">Selected Files:</h3>
          {#each files as file, i}
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div class="flex items-center gap-2">
                <FileText class="h-4 w-4" />
                <span class="text-sm">{file.name}</span>
                <span class="text-xs text-gray-500">({formatFileSize(file.size)})</span>
              </div>
              <Button variant="ghost" size="sm" on:click={() => removeFile(i)}>
                Remove
              </Button>
            </div>
          {/each}
          
          <Button 
            class="w-full mt-4" 
            on:click={uploadFiles}
            disabled={uploading}
          >
            {#if uploading}
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            {:else}
              Upload and Process
            {/if}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- Jobs List -->
  <Card>
    <CardHeader>
      <CardTitle>Processing Jobs</CardTitle>
      <CardDescription>
        Track the status of your document analysis jobs
      </CardDescription>
    </CardHeader>
    <CardContent>
      {#if jobs.length === 0}
        <p class="text-center text-gray-500 py-8">
          No jobs yet. Upload some PowerPoint files to get started.
        </p>
      {:else}
        <div class="space-y-3">
          {#each jobs as job}
            <div class="flex items-center justify-between p-4 border rounded-lg">
              <div class="flex-1">
                <h4 class="font-medium">{job.filename}</h4>
                <p class="text-sm {getStatusColor(job.status)} capitalize">
                  {job.status}
                  {#if job.status === 'processing'}
                    <Loader2 class="inline-block ml-1 h-3 w-3 animate-spin" />
                  {/if}
                </p>
                {#if job.error}
                  <p class="text-sm text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle class="h-3 w-3" />
                    {job.error}
                  </p>
                {/if}
              </div>
              
              {#if job.status === 'completed' && job.zipPath}
                <a href="/api/download/{job.id}" download>
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Download class="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </a>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
</div>