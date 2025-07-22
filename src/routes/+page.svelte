<script lang="ts">
  import PocketBase from 'pocketbase';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Upload, FileText, Download, Loader2, AlertCircle, ChevronRight, ChevronDown } from "lucide-svelte";
  import type { Job } from "$lib/server/pocketbase";
  import { onMount, onDestroy } from 'svelte';
  import { invalidate } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: { jobs: any[], pocketbaseUrl: string };

  let files: File[] = [];
  let isDragging = false;
  let uploading = false;
  let fileInput: HTMLInputElement;
  let pollInterval: ReturnType<typeof setInterval>;
  let expandedErrors = new Set<string>();

  let jobs = data.jobs;
  const pb = new PocketBase(data.pocketbaseUrl);

  onMount(() => {
    // Poll for updates every 5 seconds
    pollInterval = setInterval(() => {
      invalidate('/api/jobs');
    }, 5000);
    
    pb.authStore.loadFromCookie(document?.cookie || '');
    pb.collection('jobs').subscribe(
      '*',
      (event) => {
        if (event.action === 'create') {
          jobs = [event.record, ...jobs];
        } else if (event.action === 'update') {
          jobs = jobs.map(job => 
            job.id === event.record.id ? event.record : job
          );
        } else if (event.action === 'delete') {
          jobs = jobs.filter(job => job.id !== event.record.id);
        }
      }
    );
  });


  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    pb.collection('jobs').unsubscribe('*');
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

  function toggleError(jobId: string) {
    if (expandedErrors.has(jobId)) {
      expandedErrors.delete(jobId);
    } else {
      expandedErrors.add(jobId);
    }
    expandedErrors = expandedErrors; // Trigger reactivity
  }

  function truncateError(error: string, maxLength: number = 50): string {
    if (error.length <= maxLength) return error;
    return error.substring(0, maxLength) + '...';
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
      {#key jobs}
        {#if jobs.length === 0}
          <p class="text-center text-gray-500 py-8">
            No jobs yet. Upload some PowerPoint files to get started.
          </p>
        {:else}
          <div class="space-y-3">
            {#each jobs as job}
              <div class="p-4 border rounded-lg">
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <h4 class="font-medium truncate">{job.filename}</h4>
                    <p class="text-sm {getStatusColor(job.status)} capitalize">
                      {job.status}
                      {#if job.status === 'processing'}
                        <Loader2 class="inline-block ml-1 h-3 w-3 animate-spin" />
                      {/if}
                    </p>
                    <p class="text-xs text-gray-500">
                      Created at: {new Date(job.created).toLocaleString()}
                    </p>
                  </div>
                  
                  {#if job.status === 'completed' && job.zipPath}
                    <a href="/api/download/{job.id}" download class="ml-4 flex-shrink-0">
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
                
                {#if job.error}
                  <div class="mt-3 border-t pt-3">
                    <button
                      type="button"
                      class="w-full text-left text-sm text-red-600 hover:text-red-700 transition-colors"
                      on:click={() => toggleError(job.id)}
                    >
                      <div class="flex items-start gap-1">
                        {#if expandedErrors.has(job.id)}
                          <ChevronDown class="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {:else}
                          <ChevronRight class="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {/if}
                        <AlertCircle class="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span class="break-words">
                          {expandedErrors.has(job.id) ? 'Error details:' : `Error: ${truncateError(job.error)}`}
                        </span>
                      </div>
                    </button>
                    {#if expandedErrors.has(job.id)}
                      <div class="mt-2 ml-9 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <pre class="whitespace-pre-wrap break-words font-sans">{job.error}</pre>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          {/if}
        {/key}
      </CardContent>
  </Card>
</div>