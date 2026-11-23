<?php

namespace App\Domains\Website\Http;

use App\Domains\Website\Models\SiteFaq;
use App\Domains\Website\Models\SitePortfolio;
use App\Domains\Website\Models\SiteService;
use App\Domains\Website\Models\SiteTeamMember;
use App\Domains\Website\Models\SiteTestimonial;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** CRUD + reorder for every website content collection. The {collection} route segment picks the model. */
class SiteCollectionController
{
    /** @var array<string, class-string<Model>> */
    public const MODELS = [
        'services' => SiteService::class,
        'portfolio' => SitePortfolio::class,
        'testimonials' => SiteTestimonial::class,
        'team' => SiteTeamMember::class,
        'faqs' => SiteFaq::class,
    ];

    private function rules(string $collection, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes|required';
        $common = ['sort' => 'sometimes|integer|min:0'];

        return $common + match ($collection) {
            'services' => [
                'title' => "$req|string|max:255", 'summary' => 'nullable|string|max:500', 'body' => 'nullable|string|max:10000',
                'icon' => 'nullable|string|max:50', 'image_url' => 'nullable|url:http,https|max:2048',
                'price_from' => 'nullable|integer|min:0', 'is_published' => 'sometimes|boolean',
            ],
            'portfolio' => [
                'title' => "$req|string|max:255", 'location' => 'nullable|string|max:255', 'category' => 'nullable|string|max:100',
                'description' => 'nullable|string|max:10000', 'cover_url' => 'nullable|url:http,https|max:2048',
                'images' => 'nullable|array|max:30', 'images.*' => 'url:http,https|max:2048', 'completed_on' => 'nullable|date',
                'is_published' => 'sometimes|boolean',
            ],
            'testimonials' => [
                'author' => "$req|string|max:255", 'role' => 'nullable|string|max:255', 'quote' => "$req|string|max:3000",
                'rating' => 'sometimes|integer|between:1,5', 'is_published' => 'sometimes|boolean',
            ],
            'team' => [
                'name' => "$req|string|max:255", 'role' => 'nullable|string|max:255',
                'photo_url' => 'nullable|url:http,https|max:2048', 'bio' => 'nullable|string|max:3000',
            ],
            'faqs' => ['question' => "$req|string|max:255", 'answer' => "$req|string|max:5000"],
        };
    }

    private function model(string $collection): string
    {
        return self::MODELS[$collection] ?? abort(404);
    }

    private function find(string $collection, int $id): Model
    {
        return $this->model($collection)::findOrFail($id); // tenant global scope applies
    }

    public function index(string $collection)
    {
        return $this->model($collection)::orderBy('sort')->orderBy('id')->get();
    }

    public function store(Request $request, string $collection)
    {
        $class = $this->model($collection);
        $data = $request->validate($this->rules($collection, true));
        $data['sort'] ??= (int) $class::max('sort') + 1;

        return response()->json($class::create($data)->fresh(), 201);
    }

    public function show(string $collection, int $id)
    {
        return $this->find($collection, $id);
    }

    public function update(Request $request, string $collection, int $id)
    {
        $item = $this->find($collection, $id);
        $item->update($request->validate($this->rules($collection, false)));

        return $item->fresh();
    }

    public function destroy(string $collection, int $id)
    {
        $this->find($collection, $id)->delete();

        return response()->noContent();
    }

    /** Body: {ids: [3,1,2]} — the new order. Ids not owned by the tenant are ignored. */
    public function reorder(Request $request, string $collection)
    {
        $class = $this->model($collection);
        $ids = $request->validate(['ids' => 'required|array|max:500', 'ids.*' => 'integer'])['ids'];
        $owned = $class::whereIn('id', $ids)->pluck('id')->all();
        DB::transaction(function () use ($class, $ids, $owned) {
            foreach (array_values(array_intersect($ids, $owned)) as $i => $id) {
                $class::whereKey($id)->update(['sort' => $i]);
            }
        });

        return $this->index($collection);
    }
}
