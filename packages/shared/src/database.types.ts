export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      calendar_sources: {
        Row: {
          account_email: string | null
          color: Database["public"]["Enums"]["member_color"] | null
          created_at: string
          enabled: boolean
          external_id: string
          household_id: string
          id: string
          integration_id: string
          last_synced_at: string | null
          member_id: string | null
          name: string
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          account_email?: string | null
          color?: Database["public"]["Enums"]["member_color"] | null
          created_at?: string
          enabled?: boolean
          external_id: string
          household_id?: string
          id?: string
          integration_id: string
          last_synced_at?: string | null
          member_id?: string | null
          name: string
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          account_email?: string | null
          color?: Database["public"]["Enums"]["member_color"] | null
          created_at?: string
          enabled?: boolean
          external_id?: string
          household_id?: string
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          member_id?: string | null
          name?: string
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sources_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sources_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sources_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          ends_at: string
          external_id: string
          household_id: string
          id: string
          member_id: string | null
          source_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          ends_at: string
          external_id: string
          household_id?: string
          id?: string
          member_id?: string | null
          source_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          ends_at?: string
          external_id?: string
          household_id?: string
          id?: string
          member_id?: string | null
          source_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "calendar_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      household_settings: {
        Row: {
          created_at: string
          household_id: string
          idle_minutes: number
          kroger_location_id: string | null
          location_label: string | null
          location_zip: string | null
          parent_pin_hash: string
          pin_lock_minutes: number
          pin_protect_deletes: boolean
          pin_protect_rewards: boolean
          pin_protect_settings: boolean
          sleep_end: string
          sleep_start: string
          slide_seconds: number
          updated_at: string
          weather_units: string
        }
        Insert: {
          created_at?: string
          household_id?: string
          idle_minutes?: number
          kroger_location_id?: string | null
          location_label?: string | null
          location_zip?: string | null
          parent_pin_hash: string
          pin_lock_minutes?: number
          pin_protect_deletes?: boolean
          pin_protect_rewards?: boolean
          pin_protect_settings?: boolean
          sleep_end?: string
          sleep_start?: string
          slide_seconds?: number
          updated_at?: string
          weather_units?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          idle_minutes?: number
          kroger_location_id?: string | null
          location_label?: string | null
          location_zip?: string | null
          parent_pin_hash?: string
          pin_lock_minutes?: number
          pin_protect_deletes?: boolean
          pin_protect_rewards?: boolean
          pin_protect_settings?: boolean
          sleep_end?: string
          sleep_start?: string
          slide_seconds?: number
          updated_at?: string
          weather_units?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_settings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          import_token: string
          location_lat: number | null
          location_lon: number | null
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_token?: string
          location_lat?: number | null
          location_lon?: number | null
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          import_token?: string
          location_lat?: number | null
          location_lon?: number | null
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string | null
          account_key: string
          created_at: string
          expires_at: string | null
          household_id: string
          id: string
          meta: Json
          provider: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_key: string
          created_at?: string
          expires_at?: string | null
          household_id: string
          id?: string
          meta?: Json
          provider: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_key?: string
          created_at?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          meta?: Json
          provider?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_v2_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      jukebox_commands: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          household_id: string
          id: string
          payload: Json
          speaker_id: string | null
          status: Database["public"]["Enums"]["jukebox_command_status"]
          type: Database["public"]["Enums"]["jukebox_command_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          household_id?: string
          id?: string
          payload?: Json
          speaker_id?: string | null
          status?: Database["public"]["Enums"]["jukebox_command_status"]
          type: Database["public"]["Enums"]["jukebox_command_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          household_id?: string
          id?: string
          payload?: Json
          speaker_id?: string | null
          status?: Database["public"]["Enums"]["jukebox_command_status"]
          type?: Database["public"]["Enums"]["jukebox_command_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jukebox_commands_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jukebox_commands_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      jukebox_favorites: {
        Row: {
          added_by: string | null
          album_title: string | null
          created_at: string
          duration_ms: number | null
          household_id: string
          id: string
          image_url: string | null
          is_owned: boolean | null
          kind: Database["public"]["Enums"]["jukebox_media_kind"]
          sort_order: number
          subtitle: string | null
          title: string
          track_count: number | null
          updated_at: string
          uri: string
        }
        Insert: {
          added_by?: string | null
          album_title?: string | null
          created_at?: string
          duration_ms?: number | null
          household_id?: string
          id?: string
          image_url?: string | null
          is_owned?: boolean | null
          kind: Database["public"]["Enums"]["jukebox_media_kind"]
          sort_order?: number
          subtitle?: string | null
          title: string
          track_count?: number | null
          updated_at?: string
          uri: string
        }
        Update: {
          added_by?: string | null
          album_title?: string | null
          created_at?: string
          duration_ms?: number | null
          household_id?: string
          id?: string
          image_url?: string | null
          is_owned?: boolean | null
          kind?: Database["public"]["Enums"]["jukebox_media_kind"]
          sort_order?: number
          subtitle?: string | null
          title?: string
          track_count?: number | null
          updated_at?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "jukebox_favorites_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jukebox_favorites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      jukebox_queue: {
        Row: {
          added_at: string
          added_by: string | null
          duration_ms: number | null
          household_id: string
          id: string
          image_url: string | null
          position: number
          spotify_uri: string
          subtitle: string | null
          title: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          duration_ms?: number | null
          household_id?: string
          id?: string
          image_url?: string | null
          position: number
          spotify_uri: string
          subtitle?: string | null
          title: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          duration_ms?: number | null
          household_id?: string
          id?: string
          image_url?: string | null
          position?: number
          spotify_uri?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jukebox_queue_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jukebox_queue_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      jukebox_state: {
        Row: {
          duration_ms: number
          household_id: string
          is_playing: boolean
          now_playing: Json
          progress_ms: number
          recent: Json
          repeat: string
          shuffle: boolean
          speaker_id: string | null
          updated_at: string
          volume: number
        }
        Insert: {
          duration_ms?: number
          household_id: string
          is_playing?: boolean
          now_playing?: Json
          progress_ms?: number
          recent?: Json
          repeat?: string
          shuffle?: boolean
          speaker_id?: string | null
          updated_at?: string
          volume?: number
        }
        Update: {
          duration_ms?: number
          household_id?: string
          is_playing?: boolean
          now_playing?: Json
          progress_ms?: number
          recent?: Json
          repeat?: string
          shuffle?: boolean
          speaker_id?: string | null
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "jukebox_state_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jukebox_state_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          assignee_id: string | null
          category: string | null
          checked_at: string | null
          created_at: string
          household_id: string
          id: string
          list_id: string
          quantity: string | null
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          checked_at?: string | null
          created_at?: string
          household_id?: string
          id?: string
          list_id: string
          quantity?: string | null
          sort_order?: number
          text: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          checked_at?: string | null
          created_at?: string
          household_id?: string
          id?: string
          list_id?: string
          quantity?: string | null
          sort_order?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_share_tokens: {
        Row: {
          created_at: string
          expires_at: string
          household_id: string
          id: string
          list_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          list_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          list_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_share_tokens_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_share_tokens_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          color: Database["public"]["Enums"]["member_color"]
          created_at: string
          household_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["member_color"]
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: Database["public"]["Enums"]["member_color"]
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan: {
        Row: {
          created_at: string
          date: string
          household_id: string
          id: string
          recipe_id: string | null
          slot: Database["public"]["Enums"]["meal_slot"]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          household_id?: string
          id?: string
          recipe_id?: string | null
          slot: Database["public"]["Enums"]["meal_slot"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          recipe_id?: string | null
          slot?: Database["public"]["Enums"]["meal_slot"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          avatar: string | null
          color: Database["public"]["Enums"]["member_color"]
          created_at: string
          earns_points: boolean
          household_id: string
          id: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          role_label: string | null
          routine_filters: Database["public"]["Enums"]["task_routine"][]
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar?: string | null
          color?: Database["public"]["Enums"]["member_color"]
          created_at?: string
          earns_points?: boolean
          household_id?: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["member_role"]
          role_label?: string | null
          routine_filters?: Database["public"]["Enums"]["task_routine"][]
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar?: string | null
          color?: Database["public"]["Enums"]["member_color"]
          created_at?: string
          earns_points?: boolean
          household_id?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["member_role"]
          role_label?: string | null
          routine_filters?: Database["public"]["Enums"]["task_routine"][]
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          completion_id: string | null
          created_at: string
          delta: number
          household_id: string
          id: string
          member_id: string
          reason: string
          redemption_id: string | null
        }
        Insert: {
          completion_id?: string | null
          created_at?: string
          delta: number
          household_id?: string
          id?: string
          member_id: string
          reason: string
          redemption_id?: string | null
        }
        Update: {
          completion_id?: string | null
          created_at?: string
          delta?: number
          household_id?: string
          id?: string
          member_id?: string
          reason?: string
          redemption_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "task_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["profile_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id: string
          kind?: Database["public"]["Enums"]["profile_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["profile_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          color: Database["public"]["Enums"]["member_color"]
          cook_min: number
          created_at: string
          favorite: boolean
          household_id: string
          icon: string
          id: string
          image_path: string | null
          ingredients: Json
          prep_min: number
          servings: number
          source_url: string | null
          steps: Json
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["member_color"]
          cook_min?: number
          created_at?: string
          favorite?: boolean
          household_id?: string
          icon?: string
          id?: string
          image_path?: string | null
          ingredients?: Json
          prep_min?: number
          servings?: number
          source_url?: string | null
          steps?: Json
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          color?: Database["public"]["Enums"]["member_color"]
          cook_min?: number
          created_at?: string
          favorite?: boolean
          household_id?: string
          icon?: string
          id?: string
          image_path?: string | null
          ingredients?: Json
          prep_min?: number
          servings?: number
          source_url?: string | null
          steps?: Json
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          created_at: string
          decided_by: string | null
          household_id: string
          id: string
          member_id: string
          requested_at: string
          reward_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_by?: string | null
          household_id?: string
          id?: string
          member_id: string
          requested_at?: string
          reward_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_by?: string | null
          household_id?: string
          id?: string
          member_id?: string
          requested_at?: string
          reward_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          color: Database["public"]["Enums"]["member_color"]
          cost: number
          created_at: string
          household_id: string
          icon: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: Database["public"]["Enums"]["member_color"]
          cost: number
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: Database["public"]["Enums"]["member_color"]
          cost?: number
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          available: boolean
          cast_host: string | null
          created_at: string
          external_id: string | null
          household_id: string
          id: string
          is_group: boolean
          kind: string
          last_seen_at: string | null
          name: string
          provider: Database["public"]["Enums"]["speaker_provider"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          cast_host?: string | null
          created_at?: string
          external_id?: string | null
          household_id?: string
          id?: string
          is_group?: boolean
          kind?: string
          last_seen_at?: string | null
          name: string
          provider?: Database["public"]["Enums"]["speaker_provider"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          cast_host?: string | null
          created_at?: string
          external_id?: string | null
          household_id?: string
          id?: string
          is_group?: boolean
          kind?: string
          last_seen_at?: string | null
          name?: string
          provider?: Database["public"]["Enums"]["speaker_provider"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "speakers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          approved_by: string | null
          completed_at: string
          created_at: string
          for_date: string
          household_id: string
          id: string
          member_id: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          completed_at?: string
          created_at?: string
          for_date: string
          household_id?: string
          id?: string
          member_id?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          completed_at?: string
          created_at?: string
          for_date?: string
          household_id?: string
          id?: string
          member_id?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          due_date: string | null
          household_id: string
          icon: string | null
          id: string
          member_id: string | null
          points: number
          recurrence: string | null
          routine: Database["public"]["Enums"]["task_routine"]
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          due_date?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          member_id?: string | null
          points?: number
          recurrence?: string | null
          routine: Database["public"]["Enums"]["task_routine"]
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          due_date?: string | null
          household_id?: string
          icon?: string | null
          id?: string
          member_id?: string | null
          points?: number
          recurrence?: string | null
          routine?: Database["public"]["Enums"]["task_routine"]
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      member_points: {
        Row: {
          balance: number | null
          household_id: string | null
          member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_household_id: { Args: never; Returns: string }
      current_profile_kind: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_kind"]
      }
      invoke_calendar_sync: { Args: never; Returns: number }
      set_parent_pin: { Args: { pin: string }; Returns: undefined }
      verify_parent_pin: { Args: { pin: string }; Returns: boolean }
    }
    Enums: {
      jukebox_command_status: "pending" | "done" | "failed"
      jukebox_command_type:
        | "play"
        | "pause"
        | "resume"
        | "skip"
        | "previous"
        | "volume"
        | "transfer"
        | "queue_add"
        | "refresh_speakers"
        | "advance"
        | "shuffle"
        | "repeat"
      jukebox_media_kind: "track" | "album" | "playlist"
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack"
      member_color: "moss" | "clay" | "honey" | "fjord" | "plum"
      member_role: "parent" | "child"
      profile_kind: "person" | "kiosk"
      redemption_status: "requested" | "approved" | "denied"
      speaker_provider: "spotify_connect" | "cast" | "alexa"
      task_routine: "morning" | "afternoon" | "evening" | "chores"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      jukebox_command_status: ["pending", "done", "failed"],
      jukebox_command_type: [
        "play",
        "pause",
        "resume",
        "skip",
        "previous",
        "volume",
        "transfer",
        "queue_add",
        "refresh_speakers",
        "advance",
        "shuffle",
        "repeat",
      ],
      jukebox_media_kind: ["track", "album", "playlist"],
      meal_slot: ["breakfast", "lunch", "dinner", "snack"],
      member_color: ["moss", "clay", "honey", "fjord", "plum"],
      member_role: ["parent", "child"],
      profile_kind: ["person", "kiosk"],
      redemption_status: ["requested", "approved", "denied"],
      speaker_provider: ["spotify_connect", "cast", "alexa"],
      task_routine: ["morning", "afternoon", "evening", "chores"],
    },
  },
} as const
